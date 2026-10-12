import {spawn} from 'node:child_process'
import {basename, dirname, extname, join} from 'node:path'

import {helpers} from 'ytdlp-nodejs'

import type {AlignedWord} from './audiocpp-client.js'

// 对齐模型无分块能力(vad_chunking 仅 ASR 转写具备), 音频超过 encoder 上限(实测 90~120 秒之间)会报
// max_source_positions 错误, 故长音频按静音点切段, 每段独立转写+对齐
export const CHUNK_TARGET_SECONDS = 60
export const CHUNK_MIN_SECONDS = 30

// 词级时间戳的采样字段换算用, 与预处理输出(-ar 16000)保持一致
const CHUNK_SAMPLE_RATE = 16_000

// 静音检测参数: 低于 -35dB 且持续 0.3 秒以上视为静音(句间停顿量级)
const SILENCE_NOISE_DB = '-35dB'
const SILENCE_MIN_SECONDS = '0.3'

/**
 * 单个音频分段(相对整段 wav 的起止秒)
 */
export interface AudioChunk {
  startSeconds: number
  endSeconds: number
}

/**
 * 音频分段计划
 */
export interface AudioChunkPlan {
  durationSeconds: number
  chunks: AudioChunk[]
}

/**
 * 规划长音频分段: 长度不超过目标段长时整体为一段, 否则优先在静音中点切段(避免切断词语),
 * 附近无静音点时退化为按目标段长硬切。
 */
export function planChunkBoundaries(durationSeconds: number, silenceMidpoints: number[]): AudioChunk[] {
  const chunks: AudioChunk[] = []
  let cursor = 0

  while ((durationSeconds - cursor) > CHUNK_TARGET_SECONDS) {
    // 切点窗口: 切出的段不短于 CHUNK_MIN_SECONDS, 最长 CHUNK_TARGET_SECONDS
    const windowStart = cursor + CHUNK_MIN_SECONDS
    const windowEnd = cursor + CHUNK_TARGET_SECONDS
    const windowMidpoints = silenceMidpoints.filter((midpoint) => (midpoint > windowStart) && (midpoint <= windowEnd))
    // 优先取窗口内最晚的静音中点(段尽量长且落在自然停顿处), 无静音点则硬切
    const cutPoint = (windowMidpoints.length > 0) ? Math.max(...windowMidpoints) : windowEnd
    chunks.push({startSeconds: cursor, endSeconds: cutPoint})
    cursor = cutPoint
  }

  chunks.push({startSeconds: cursor, endSeconds: durationSeconds})
  return chunks
}

/**
 * 把段内对齐出的词级时间戳平移到整段音频的时间轴上(秒与采样字段同步偏移)。
 */
export function offsetAlignedWords(words: AlignedWord[], offsetSeconds: number): AlignedWord[] {
  const offsetSamples = Math.round(offsetSeconds * CHUNK_SAMPLE_RATE)
  return words.map((word) => ({
    ...word,
    start: word.start + offsetSeconds,
    end: word.end + offsetSeconds,
    // 服务端字段为 snake_case, 无法改名
    // eslint-disable-next-line camelcase
    start_sample: word.start_sample + offsetSamples,
    // 服务端字段为 snake_case, 无法改名
    // eslint-disable-next-line camelcase
    end_sample: word.end_sample + offsetSamples,
  }))
}

/**
 * 探测 wav 时长并生成分段计划(供 sub 命令使用)。
 */
export async function planAudioChunks(wavPath: string): Promise<AudioChunkPlan> {
  const durationSeconds = await probeWavDurationSeconds(wavPath)
  const silenceMidpoints = (durationSeconds > CHUNK_TARGET_SECONDS)
    ? await detectSilenceMidpoints(wavPath)
    : []
  return {chunks: planChunkBoundaries(durationSeconds, silenceMidpoints), durationSeconds}
}

/**
 * 用 ffmpeg 从整段 wav 中无损切出一段(-c copy, pcm 数据按采样点精确切割)。
 */
export async function cutWavChunk(wavPath: string, chunk: AudioChunk, outputPath: string): Promise<void> {
  const ffmpegPath = findFfTool('ffmpeg')
  await runProcess(ffmpegPath, [
    '-y',
    '-i', wavPath,
    '-ss', String(chunk.startSeconds),
    '-t', String(chunk.endSeconds - chunk.startSeconds),
    '-c', 'copy',
    outputPath,
  ])
}

// 用 ffprobe 读取音频总时长(秒)
async function probeWavDurationSeconds(wavPath: string): Promise<number> {
  const ffprobePath = findFfTool('ffprobe')
  const output = await runProcess(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    wavPath,
  ])
  const duration = Number.parseFloat(output.trim())
  if (Number.isNaN(duration)) {
    throw new TypeError(`ffprobe 未能解析音频时长, 输出: ${output.trim()}`)
  }
  return duration
}

// 解析 ffmpeg silencedetect 输出, 返回各静音区间的中点(秒)
async function detectSilenceMidpoints(wavPath: string): Promise<number[]> {
  const ffmpegPath = findFfTool('ffmpeg')
  const output = await runProcess(ffmpegPath, [
    '-i', wavPath,
    '-af', `silencedetect=noise=${SILENCE_NOISE_DB}:d=${SILENCE_MIN_SECONDS}`,
    '-f', 'null',
    '-',
  ])

  // silencedetect 成对输出 silence_start 与 silence_end, 中点即自然停顿位置
  const midpoints: number[] = []
  const startMatches = output.matchAll(/silence_start:\s*([\d.]+)/g)
  const endMatches = output.matchAll(/silence_end:\s*([\d.]+)/g)
  const starts = [...startMatches].map((match) => Number.parseFloat(match[1]))
  const ends = [...endMatches].map((match) => Number.parseFloat(match[1]))
  for (let index = 0; index < Math.min(starts.length, ends.length); index += 1) {
    midpoints.push((starts[index] + ends[index]) / 2)
  }
  return midpoints
}

// ffmpeg 与 ffprobe 同目录分发, 随 ytdlp-nodejs 探测结果定位
function findFfTool(toolName: 'ffmpeg' | 'ffprobe'): string {
  const ffmpegPath = helpers.findFFmpegBinary()
  if (!ffmpegPath) {
    throw new Error('未找到 ffmpeg, 无法处理音频, 请先执行: vp dl check --update')
  }
  return join(dirname(ffmpegPath), `${toolName}${extname(ffmpegPath)}`)
}

// 运行外部命令, 合并返回 stdout+stderr 文本, 退出码非 0 时抛错
function runProcess(executablePath: string, arguments_: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn(executablePath, arguments_, {windowsHide: true})
    let outputText = ''
    proc.stdout.on('data', (data) => {
      outputText += String(data)
    })
    proc.stderr.on('data', (data) => {
      outputText += String(data)
    })
    proc.on('error', reject)
    proc.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolve(outputText)
      } else {
        reject(new Error(`${basename(executablePath)} 执行失败 (退出码 ${exitCode})`))
      }
    })
  })
}
