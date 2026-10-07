import {spawn} from 'node:child_process'
import {helpers} from 'ytdlp-nodejs'

import {readDuration} from './probe.js'

// #region 类型定义
export interface AudioSegment {
  end: number
  start: number
}

export interface TrimSilenceLogger {
  log(message: string): void
}

export interface TrimSilenceOptions {
  // 最短静音时长(秒), 短于它的静音不切, 避免把句内停顿误判为静音
  minSilence: number
  // 语音段首尾保留的余量(秒), 避免阈值抖动削掉字头字尾
  padding: number
  // 静音判定阈值, 响度低于该值的片段视为静音(如 -30dB)
  threshold: string
}
// #endregion

// #region 常量
// 时间比较容差: 静音检测精度约 1ms, 用它避免浮点误差产生空区间
const TIME_EPSILON = 1e-3

const SILENCE_START_PATTERN = /silence_start:\s*(-?[\d.]+)/
const SILENCE_END_PATTERN = /silence_end:\s*(-?[\d.]+)/
// #endregion

// #region 子进程执行
interface CaptureResult {
  stderr: string
  stdout: string
}

function runCapture(command: string, args: string[]): Promise<CaptureResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args)

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    proc.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({stderr, stdout})
      } else {
        reject(new Error(`ffmpeg 执行失败 (退出码 ${code}): ${stderr.trim()}`))
      }
    })
  })
}

function requireFfmpeg(): string {
  const ffmpegPath = helpers.findFFmpegBinary()
  if (!ffmpegPath) {
    throw new Error('未找到 ffmpeg, 无法切除静音')
  }

  return ffmpegPath
}
// #endregion

// #region 探测与检测
// 从 silencedetect 的 stderr 输出中解析静音区间
export function parseSilences(stderr: string): AudioSegment[] {
  const silences: AudioSegment[] = []
  let pendingStart: null | number = null

  for (const line of stderr.split(/\r?\n/)) {
    const startMatch = SILENCE_START_PATTERN.exec(line)
    if (startMatch) {
      pendingStart = Number(startMatch[1])
      continue
    }

    const endMatch = SILENCE_END_PATTERN.exec(line)
    if (endMatch && (pendingStart !== null)) {
      silences.push({end: Number(endMatch[1]), start: pendingStart})
      pendingStart = null
    }
  }

  // 静音持续到文件末尾时 ffmpeg 不输出 silence_end, 用 Infinity 标记, 后续按文件末尾处理
  if (pendingStart !== null) {
    silences.push({end: Number.POSITIVE_INFINITY, start: pendingStart})
  }

  return silences
}

async function detectSilences(audioPath: string, options: TrimSilenceOptions): Promise<AudioSegment[]> {
  const filter = `silencedetect=noise=${options.threshold}:d=${options.minSilence}`
  // -f null - 只做分析不产出文件, 静音区间通过 stderr 上报
  const {stderr} = await runCapture(requireFfmpeg(), [
    '-hide_banner', '-nostats',
    '-i', audioPath,
    '-af', filter,
    '-f', 'null', '-',
  ])

  return parseSilences(stderr)
}
// #endregion

// #region 区间计算(纯函数)
// 把静音区间收缩为待切除区间: 首尾静音一路切到边界, 中间静音两端各让出 padding 留给语音
export function buildCutSegments(silences: AudioSegment[], duration: number, padding: number): AudioSegment[] {
  const cuts: AudioSegment[] = []

  for (const {end, start} of silences) {
    const isAtHead = (start <= TIME_EPSILON)
    const isAtTail = (end >= (duration - TIME_EPSILON))

    const cutStart = isAtHead ? 0 : (start + padding)
    const cutEnd = isAtTail ? duration : (end - padding)

    // 收缩后已无区间可切(静音本身比 padding 还短), 跳过以免白白多一次拼接
    if ((cutEnd - cutStart) > TIME_EPSILON) {
      cuts.push({end: cutEnd, start: cutStart})
    }
  }

  return cuts
}

// 取待切除区间的补集, 得到需要保留的语音区间
export function buildKeepSegments(cuts: AudioSegment[], duration: number): AudioSegment[] {
  const keeps: AudioSegment[] = []
  let cursor = 0

  for (const cut of cuts) {
    if ((cut.start - cursor) > TIME_EPSILON) {
      keeps.push({end: cut.start, start: cursor})
    }
    cursor = Math.max(cursor, cut.end)
  }

  if ((duration - cursor) > TIME_EPSILON) {
    keeps.push({end: duration, start: cursor})
  }

  return keeps
}

export function buildTrimmedPath(audioPath: string): string {
  return audioPath.replace(/(\.[^.]+)$/, '.trimmed$1')
}

// 用户可能只写数值而不带单位, 统一补齐 dB 后交给 ffmpeg
export function normalizeThreshold(input: string): string {
  const value = input.trim()
  return value.toLowerCase().endsWith('db') ? value : `${value}dB`
}
// #endregion

// #region 渲染
function buildFilterComplex(keeps: AudioSegment[]): string {
  const chains = keeps.map((segment, index) => {
    // atrim 精确裁剪到毫秒, asetpts 重置时间戳, 否则拼接后时间轴会错乱
    const trim = `atrim=start=${segment.start.toFixed(3)}:end=${segment.end.toFixed(3)},asetpts=PTS-STARTPTS`
    const label = (keeps.length === 1) ? 'out' : `s${index}`
    return `[0:a]${trim}[${label}]`
  })

  if (keeps.length === 1) return chains[0]

  const inputs = keeps.map((_, index) => `[s${index}]`).join('')
  chains.push(`${inputs}concat=n=${keeps.length}:v=0:a=1[out]`)
  return chains.join(';')
}

async function renderTrimmed(audioPath: string, keeps: AudioSegment[], outputPath: string): Promise<void> {
  await runCapture(requireFfmpeg(), [
    '-y',
    '-i', audioPath,
    '-filter_complex', buildFilterComplex(keeps),
    '-map', '[out]',
    outputPath,
  ])
}
// #endregion

// 检测并切除音频中的静音片段, 返回输出文件路径
export async function trimSilence(
  audioPath: string,
  options: TrimSilenceOptions,
  logger?: TrimSilenceLogger,
): Promise<string> {
  // #region 探测原始时长
  const duration = await readDuration(audioPath)
  logger?.log(`原音频时长: ${duration.toFixed(1)}s`)
  // #endregion

  // #region 检测静音
  const silences = await detectSilences(audioPath, options)
  if (silences.length === 0) {
    throw new Error('未检测到静音片段, 无需切除(可尝试调高阈值或缩短最短静音时长)')
  }
  logger?.log(`检测到 ${silences.length} 段静音`)
  silences.forEach((segment, index) => {
    const end = Number.isFinite(segment.end) ? segment.end.toFixed(2) : '文件末尾'
    logger?.log(`  静音 #${index + 1}: ${segment.start.toFixed(2)} → ${end}`)
  })
  // #endregion

  // #region 计算保留区间
  const cuts = buildCutSegments(silences, duration, options.padding)
  const keeps = buildKeepSegments(cuts, duration)
  if (keeps.length === 0) {
    throw new Error('全部内容都被判定为静音, 已中止(请检查阈值设置)')
  }

  const keptSeconds = keeps.reduce((total, segment) => total + (segment.end - segment.start), 0)
  logger?.log(`保留 ${keeps.length} 段语音: ${duration.toFixed(1)}s → ${keptSeconds.toFixed(1)}s`)
  // #endregion

  // #region 拼接输出
  const outputPath = buildTrimmedPath(audioPath)
  await renderTrimmed(audioPath, keeps, outputPath)
  logger?.log(`已生成: ${outputPath}`)
  return outputPath
  // #endregion
}
