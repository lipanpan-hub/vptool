import {spawn} from 'node:child_process'
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs'
import {basename, dirname, join} from 'node:path'

import type {AudioCppClient} from './audiocpp-client.js'

// IndexTTS2.5 服务端输出 22050Hz 单声道 16 位 wav, 时间轴与缓存都按此采样率计算
const DUB_SAMPLE_RATE = 22_050
const BYTES_PER_SAMPLE = 2
const MS_PER_SECOND = 1000
const WAV_HEADER_SIZE = 44
const WAV_RIFF_HEADER_SIZE = 12
const WAV_CHUNK_HEADER_SIZE = 8
// 每条配音结尾至少留出的静音, 避免相邻两句首尾相连
const TAIL_GAP_MS = 60
// 变速倍率上限: 超过后辅音会糊, 仍放不下就截断并告警
const MAX_TEMPO = 3
// 变速时额外多加 1% 余量, 避免 atempo 输出长度的取整误差让配音刚好卡在边界上
const TEMPO_MARGIN_RATIO = 0.01
// 缓存文件扩展名(单条配音的原速裸 PCM)
const CACHE_PCM_EXTENSION = '.pcm'

export interface DubCue {
  endMs: number
  startMs: number
  text: string
}

// 一条待配音字幕
interface DubTask {
  // 缓存里原速 pcm 的实际时长(合成后测量)
  clipMs: number
  readonly id: string // 同时是缓存输出的文件名(不含扩展名)
  readonly index: number
  // 配音允许的最大时长(字幕槽位减去尾部留白)
  readonly maxClipMs: number
  readonly pcmPath: string
  readonly startMs: number
  readonly text: string
}

export interface DubPipelineOptions {
  client: AudioCppClient
  language: string
  // 进度输出回调(命令层传 this.log)
  log: (message: string) => void
  // 已装载的 TTS 模型 id(= spec family, 约定 index_tts2)
  modelId: string
  // 参考音频里说的文字, 仅配合 voiceRefPath 使用
  referenceText?: string
  // 服务内置音色名, 未指定参考音频时使用
  voiceName: string
  // 参考音频绝对路径(由服务端进程读取), 指定后优先于内置音色
  voiceRefPath?: string
}

export interface DubResult {
  // 单条配音的原速 pcm 缓存目录(重跑时已有条目直接复用, 支持续跑)
  cacheDir: string
  wavPath: string
}

// #region VTT 解析

// 兼容 MM:SS.mmm 与 HH:MM:SS.mmm 两种时间戳
const TIMING_LINE = /^(\d{2}(?::\d{2}){0,2}\.\d{3})\s+-->\s+(\d{2}(?::\d{2}){0,2}\.\d{3})/
// 剥离词级时间戳/说话人等全部内联标签; 兼容文件末尾被截断的未闭合标签
const ANY_TAG = /<[^>]*(>|$)/g

// WebVTT 要求 cue 文本里的 & < > 写成字符引用, 交给 TTS 前要还原成真实文字
const VTT_ENTITY = /&(amp|gt|lt|nbsp);/g
const ENTITY_CHARS: Record<string, string> = {amp: '&', gt: '>', lt: '<', nbsp: ' '}

/**
 * 解析弹出式 VTT 为配音 cue 列表:
 * 时间行开启一条 cue, 空行结束; 序号行与 WEBVTT 头不在 cue 内自然被忽略,
 * cue 内文本剥离全部内联标签并还原字符引用, 多行合并为一个字符串。
 */
export function parseDubCues(vttContent: string): DubCue[] {
  const cues: DubCue[] = []
  let isCollectingText = false
  for (const rawLine of vttContent.replaceAll('\r\n', '\n').split('\n')) {
    const timing = TIMING_LINE.exec(rawLine.trim())
    if (timing !== null) {
      cues.push({endMs: toMilliseconds(timing[2]), startMs: toMilliseconds(timing[1]), text: ''})
      isCollectingText = true
      continue
    }

    const line = rawLine.trim()
    if (line === '') {
      isCollectingText = false
      continue
    }

    const currentCue = cues.at(-1)
    if (isCollectingText && currentCue !== undefined) {
      const plainText = decodeVttText(line.replaceAll(ANY_TAG, '').trim())
      if (plainText !== '') {
        currentCue.text = (currentCue.text === '') ? plainText : `${currentCue.text} ${plainText}`
      }
    }
  }
  return cues
}

function decodeVttText(text: string): string {
  return text.replaceAll(VTT_ENTITY, (_entity, name: string) => ENTITY_CHARS[name])
}

function toMilliseconds(timestamp: string): number {
  const parts = timestamp.split(':').map(Number)
  // 先把高位换算成秒再整体乘 1000, 避免浮点误差放大
  const totalSeconds = (parts.length === 3)
    ? ((parts[0] * 3600) + (parts[1] * 60)) + parts[2]
    : (parts[0] * 60) + parts[1]
  return Math.round(totalSeconds * 1000)
}

// #endregion

// #region PCM 时间轴

/**
 * 一条完整的时间线音轨: 预先分配好全长静音, 每条配音按毫秒偏移写入,
 * 保证起点与字幕严格对齐。
 */
export class PcmTimeline {
  private readonly buffer: Buffer

  constructor(totalMs: number, private readonly sampleRate: number) {
    this.buffer = Buffer.alloc(this.msToSamples(totalMs) * BYTES_PER_SAMPLE)
  }

  static bytesToMs(byteLength: number, sampleRate: number): number {
    return ((byteLength / BYTES_PER_SAMPLE) / sampleRate) * MS_PER_SECOND
  }

  /**
   * 把一段 pcm 写到指定起点, 超出 maxMs 的部分截掉
   * @returns 实际写入的时长(毫秒)
   */
  place(pcm: Buffer, startMs: number, maxMs: number): number {
    const offset = this.msToSamples(startMs) * BYTES_PER_SAMPLE
    const maxBytes = this.msToSamples(maxMs) * BYTES_PER_SAMPLE
    // 可写入字节数取三者最小: 配音长度 / 字幕槽位上限 / 时间轴剩余空间
    const writable = Math.min(pcm.length, maxBytes, this.buffer.length - offset)
    pcm.copy(this.buffer, offset, 0, writable)
    return PcmTimeline.bytesToMs(writable, this.sampleRate)
  }

  toWav(): Buffer {
    const header = Buffer.alloc(WAV_HEADER_SIZE)
    const byteRate = this.sampleRate * BYTES_PER_SAMPLE
    header.write('RIFF', 0)
    header.writeUInt32LE((WAV_HEADER_SIZE - 8) + this.buffer.length, 4)
    header.write('WAVEfmt ', 8)
    header.writeUInt32LE(16, 16) // fmt 块长度
    header.writeUInt16LE(1, 20) // PCM
    header.writeUInt16LE(1, 22) // 单声道
    header.writeUInt32LE(this.sampleRate, 24)
    header.writeUInt32LE(byteRate, 28)
    header.writeUInt16LE(BYTES_PER_SAMPLE, 32)
    header.writeUInt16LE(BYTES_PER_SAMPLE * 8, 34)
    header.write('data', 36)
    header.writeUInt32LE(this.buffer.length, 40)
    return Buffer.concat([header, this.buffer])
  }

  private msToSamples(ms: number): number {
    return Math.round((ms * this.sampleRate) / MS_PER_SECOND)
  }
}

// #endregion

/**
 * 配音管线(外观模式): 对命令层暴露单一 dub 入口,
 * 内部串起 解析字幕 → 逐条合成(缓存永远是原速 pcm, 已有缓存直接复用) →
 * 拼接时对超出字幕时长的条目用 ffmpeg atempo 变速不变调 → 按时间轴拼接写出 wav。
 * 任一条合成失败即中止, 重跑时凭缓存续跑。
 */
export class IndexTtsDubPipeline {
  constructor(private readonly options: DubPipelineOptions) {}

  async dub(vttPath: string, outputDir?: string): Promise<DubResult> {
    const dubDir = outputDir ?? dirname(vttPath)
    const dubBase = basename(vttPath).replace(/\.vtt$/i, '')
    const cacheDir = join(dubDir, `${dubBase}.dub`)
    const wavPath = join(dubDir, `${dubBase}.dub.wav`)
    mkdirSync(cacheDir, {recursive: true})

    const cues = parseDubCues(readFileSync(vttPath, 'utf8'))
    const tasks = this.buildTasks(cues, cacheDir)
    if (tasks.length === 0) {
      throw new Error('字幕里没有可配音的文本')
    }

    await this.synthesizeMissing(tasks)

    const timeline = new PcmTimeline(cues.at(-1)!.endMs, DUB_SAMPLE_RATE)
    await this.placeAll(tasks, timeline)
    writeFileSync(wavPath, timeline.toWav())
    return {cacheDir, wavPath}
  }

  // #region 任务构建

  // 空文本的 cue 不配音(纯时间戳/标签行剥离后为空)
  private buildTasks(cues: DubCue[], cacheDir: string): DubTask[] {
    const tasks: DubTask[] = []
    for (const [index, cue] of cues.entries()) {
      if (cue.text === '') continue
      const slotMs = cue.endMs - cue.startMs
      const id = String(index + 1).padStart(4, '0')
      tasks.push({
        clipMs: 0,
        id,
        index,
        maxClipMs: (slotMs > TAIL_GAP_MS) ? (slotMs - TAIL_GAP_MS) : slotMs,
        pcmPath: join(cacheDir, `${id}${CACHE_PCM_EXTENSION}`),
        startMs: cue.startMs,
        text: cue.text,
      })
    }
    return tasks
  }

  // #endregion

  // #region 逐条合成(带缓存)

  // 缓存里没有的逐条按自然语速合成; 缓存永远是原速 pcm, 变速只在拼接时做
  private async synthesizeMissing(tasks: DubTask[]): Promise<void> {
    const missingTasks = tasks.filter((task) => !existsSync(task.pcmPath))
    this.options.log(`需要合成 ${missingTasks.length} 条, 复用缓存 ${tasks.length - missingTasks.length} 条`)

    for (const [position, task] of missingTasks.entries()) {
      // eslint-disable-next-line no-await-in-loop -- 服务端同一模型一次只跑一个请求, 必须顺序合成
      const wavBytes = await this.options.client.synthesizeSpeech({
        language: this.options.language,
        modelId: this.options.modelId,
        responseFormat: 'wav',
        text: task.text,
        voiceName: this.options.voiceRefPath === undefined ? this.options.voiceName : undefined,
        voiceRefPath: this.options.voiceRefPath,
      })
      writeFileSync(task.pcmPath, IndexTtsDubPipeline.extractPcm(wavBytes))
      this.options.log(`  已合成 ${position + 1}/${missingTasks.length}: [${task.id}] ${task.text}`)
    }

    for (const task of tasks) task.clipMs = this.measureClipMs(task.pcmPath)

    const overflowCount = tasks.filter((task) => task.clipMs > task.maxClipMs).length
    const overflowPercent = (tasks.length > 0) ? Math.round((overflowCount / tasks.length) * 100) : 0
    this.options.log(`原速配音超出字幕时长, 拼接时需要变速: ${overflowCount}/${tasks.length} 条 (${overflowPercent}%)`)
  }

  // 从 wav 里取出 data 块的裸 PCM, 并确认采样率与时间轴约定一致
  private static extractPcm(wav: Buffer): Buffer {
    if (wav.toString('ascii', 0, 4) !== 'RIFF') throw new Error('服务返回的不是 wav 音频')

    let sampleRate = 0
    let offset = WAV_RIFF_HEADER_SIZE
    while ((offset + WAV_CHUNK_HEADER_SIZE) <= wav.length) {
      const chunkId = wav.toString('ascii', offset, offset + 4)
      const chunkSize = wav.readUInt32LE(offset + 4)
      const bodyStart = offset + WAV_CHUNK_HEADER_SIZE
      if (chunkId === 'fmt ') sampleRate = wav.readUInt32LE(bodyStart + 4)
      if (chunkId === 'data') {
        if (sampleRate !== DUB_SAMPLE_RATE) {
          throw new Error(`服务返回的采样率是 ${sampleRate}, 期望 ${DUB_SAMPLE_RATE}`)
        }
        return wav.subarray(bodyStart, bodyStart + chunkSize)
      }

      // wav 块按偶数字节对齐
      offset = bodyStart + chunkSize + (chunkSize % 2)
    }

    throw new Error('wav 里找不到 data 块')
  }

  private measureClipMs(pcmPath: string): number {
    return PcmTimeline.bytesToMs(statSync(pcmPath).size, DUB_SAMPLE_RATE)
  }

  // #endregion

  // #region 按时间轴拼接

  private async placeAll(tasks: DubTask[], timeline: PcmTimeline): Promise<void> {
    for (const task of tasks) {
      const label = `[${task.index + 1}]`
      const originalPcm = readFileSync(task.pcmPath)
      const isOverflowing = task.clipMs > task.maxClipMs

      // 需要的倍率 = 原时长 / 允许时长, 再乘 (1 + 余量), 最高 MAX_TEMPO
      const tempo = Math.min(MAX_TEMPO, (task.clipMs / task.maxClipMs) * (1 + TEMPO_MARGIN_RATIO))
      // eslint-disable-next-line no-await-in-loop -- 逐条拼接需要顺序执行并逐条输出进度
      const pcm = isOverflowing ? (await this.adjustTempo(originalPcm, tempo)) : originalPcm
      const clipMs = PcmTimeline.bytesToMs(pcm.length, DUB_SAMPLE_RATE)

      const placedMs = timeline.place(pcm, task.startMs, task.maxClipMs)
      const tempoNote = isOverflowing ? ` 原速 ${Math.round(task.clipMs)}ms, 变速 ×${tempo.toFixed(2)} →` : ''
      if (placedMs < (clipMs - 1)) {
        this.options.log(`${label} 警告: 变速 ×${tempo.toFixed(2)} 后仍超出字幕时长, 已截断 (${Math.round(clipMs)}ms > ${Math.round(task.maxClipMs)}ms): ${task.text}`)
      } else {
        this.options.log(`${label}${tempoNote} ${Math.round(clipMs)}ms (上限 ${Math.round(task.maxClipMs)}ms)`)
      }
    }
  }

  // ffmpeg atempo 变速不变调: stdin/stdout 直传裸 PCM, 不落临时文件
  private adjustTempo(pcm: Buffer, tempo: number): Promise<Buffer> {
    const args = [
      '-hide_banner', '-loglevel', 'error',
      '-f', 's16le', '-ar', String(DUB_SAMPLE_RATE), '-ac', '1', '-i', 'pipe:0',
      '-filter:a', `atempo=${tempo.toFixed(4)}`,
      '-f', 's16le', 'pipe:1',
    ]
    const child = spawn('ffmpeg', args)
    const outputChunks: Buffer[] = []
    const errorChunks: Buffer[] = []

    child.stdout.on('data', (chunk: Buffer) => outputChunks.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => errorChunks.push(chunk))
    // ffmpeg 提前退出时 stdin 会 EPIPE, 真正的原因由退出码和 stderr 报告
    child.stdin.on('error', () => {})

    return new Promise((resolve, reject) => {
      child.on('error', (error: NodeJS.ErrnoException) => {
        const reason = (error.code === 'ENOENT') ? '找不到 ffmpeg, 请先安装并加入 PATH' : error.message
        reject(new Error(`调用 ffmpeg 变速失败: ${reason}`))
      })
      child.on('close', (exitCode) => {
        if (exitCode === 0) {
          resolve(Buffer.concat(outputChunks))
        } else {
          reject(new Error(`ffmpeg 变速失败 (退出码 ${exitCode}): ${Buffer.concat(errorChunks).toString('utf8').slice(0, 300)}`))
        }
      })

      child.stdin.end(pcm)
    })
  }

  // #endregion
}
