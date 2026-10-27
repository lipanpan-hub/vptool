import {spawn} from 'node:child_process'
import {extname} from 'node:path'
import {helpers} from 'ytdlp-nodejs'

import {readAudioCodec, readDuration} from './probe.js'

// #region 常量
// CRF 取值范围 0-51, 数值越小画质越高、体积越大
export const MIN_CRF = 0
export const MAX_CRF = 51
// #endregion

// #region 类型定义
// 与 ASS 样式字段一一对应; 未提供的字段留给 ffmpeg 默认值
export interface SubtitleStyle {
  // ASS numpad 布局: 1/2/3 底部, 4/5/6 中部, 7/8/9 顶部
  alignment?: number
  // #RRGGBB
  fontColor?: string
  fontName?: string
  fontSize?: number
  // 字幕不透明度(0-1, 缺省 1 不透明), 同时作用于填充色与描边色的透明通道
  fontOpacity?: number
  // 字幕距画面边缘的垂直像素
  marginV?: number
  // #RRGGBB
  outlineColor?: string
  // 换行样式(ASS WrapStyle, 实测 force_style 可覆盖): 2 为禁止自动换行, 超长文本单行显示并横向溢出画面两侧
  wrapStyle?: number
}

// 一条待烧写的字幕: path 为字幕文件, style 为该条字幕独立样式(多字幕可分别指定位置与字号)
export interface SubtitleInput {
  path: string
  style?: SubtitleStyle
}

export interface BurnSubtitleOptions {
  crf?: number
  outputPath?: string
  // 进度行写入的流, 默认 stdout; --json 模式下传 stderr 以保证 stdout 只有结果 JSON
  progressStream?: NodeJS.WriteStream
}
// #endregion

// #region 参数校验(纯函数)
// 只接受 #RRGGBB(可省略 #)的六位十六进制颜色
export function isValidHexColor(color: string): boolean {
  return /^#?[0-9a-f]{6}$/i.test(color.trim())
}

export function isValidCrf(crf: number): boolean {
  return Number.isInteger(crf) && (crf >= MIN_CRF) && (crf <= MAX_CRF)
}

export function isValidAlignment(alignment: number): boolean {
  return Number.isInteger(alignment) && (alignment >= 1) && (alignment <= 9)
}
// #endregion

// #region 滤镜构造(纯函数)
// 不透明度(0-1)转 ASS Alpha 通道: 00 为完全不透明, FF 为完全透明
function toAssAlpha(fontOpacity: number): string {
  const alpha = Math.round((1 - fontOpacity) * 255)
  return alpha.toString(16).padStart(2, '0').toUpperCase()
}

// #RRGGBB + 不透明度 -> ASS 的 &HAABBGGRR
function toAssColor(color: string, fontOpacity: number): string {
  const digits = color.trim().replace(/^#/, '')
  const red = digits.slice(0, 2)
  const green = digits.slice(2, 4)
  const blue = digits.slice(4, 6)

  // ASS 颜色分量顺序是透明通道 + BGR, 与 CSS 的 RGB 相反
  return `&H${toAssAlpha(fontOpacity)}${blue}${green}${red}`.toUpperCase()
}

// 把样式映射为 subtitles 滤镜的 force_style 串, 无有效字段时返回空串
export function buildForceStyle(style: SubtitleStyle): string {
  const fields: string[] = []
  const fontOpacity = style.fontOpacity ?? 1

  if (style.fontName) fields.push(`FontName=${style.fontName}`)
  if (style.fontSize !== undefined) fields.push(`FontSize=${style.fontSize}`)
  if (style.fontColor) fields.push(`PrimaryColour=${toAssColor(style.fontColor, fontOpacity)}`)
  if (style.outlineColor) fields.push(`OutlineColour=${toAssColor(style.outlineColor, fontOpacity)}`)
  if (style.alignment !== undefined) fields.push(`Alignment=${style.alignment}`)
  if (style.marginV !== undefined) fields.push(`MarginV=${style.marginV}`)
  if (style.wrapStyle !== undefined) fields.push(`WrapStyle=${style.wrapStyle}`)

  return fields.join(',')
}

// ffmpeg 滤镜参数要经两层解析(filtergraph 取参与选项取值), 每层都把 \ 当转义符、' 当引用符
// 特殊字符统一写成 \\\x: filtergraph 层还原为 \x, 选项层再还原为 x, 任何一层都不会误当分隔符或引用
// 因此不能再用单引号包裹路径 -- 引号内的单引号无法表达, 含 ' 的文件名必然解析错乱
function escapeFilterPath(filePath: string): string {
  return filePath
    .replaceAll('\\', '/')
    .replaceAll(/([':[\],;=])/g, String.raw`\\\$1`)
}

// 组装 subtitles 滤镜串
// filename 经 escapeFilterPath 全量转义; force_style 内容可控(无引号), 保持单引号包裹以保护其中的逗号与等号
export function buildSubtitleFilter(subtitlePath: string, style: SubtitleStyle = {}): string {
  const args = [`filename=${escapeFilterPath(subtitlePath)}`]
  const forceStyle = buildForceStyle(style)
  if (forceStyle) args.push(`force_style='${forceStyle}'`)

  return `subtitles=${args.join(':')}`
}

// 输出到源文件旁: input.mp4 -> input.burned.mp4, 不覆盖源视频
export function buildBurnedPath(videoPath: string): string {
  return videoPath.replace(/(\.[^.]+)$/, '.burned$1')
}
// #endregion

// #region 容器编码策略
// 不同容器对编解码器有硬性约束: WebM 只接受 VP8/VP9/AV1 + Vorbis/Opus, 其余容器较宽松
// 新增容器支持时只需在策略表里追加一条
interface ContainerEncodingStrategy {
  buildAudioArgs(sourceAudioCodec: null | string): string[]
  buildVideoArgs(crf: number): string[]
  // 各编码器的 CRF 语义不同(如 SVT-AV1 的 35 约等于 x264 的 23), 默认值随策略走
  defaultCrf: number
  extensions: string[]
}

// WebM 音频只允许 Vorbis/Opus, 源音频已是其中之一时直接复制, 否则转 Opus
const WEBM_AUDIO_CODECS = new Set(['opus', 'vorbis'])

// WebM 容器: NVENC 没有可用的 VP9/AV1 编码器, 故选软件 AV1(SVT-AV1)
// 实测同源下 SVT-AV1 比 libvpx-vp9 快约 2.3 倍, 体积还小约 37%
const WEBM_STRATEGY: ContainerEncodingStrategy = {
  buildAudioArgs: (sourceAudioCodec) =>
    ((sourceAudioCodec !== null) && WEBM_AUDIO_CODECS.has(sourceAudioCodec))
      ? ['-c:a', 'copy']
      : ['-c:a', 'libopus', '-b:a', '128k'],
  buildVideoArgs: (crf) => ['-c:v', 'libsvtav1', '-crf', String(crf), '-preset', '8'],
  defaultCrf: 35,
  extensions: ['.webm'],
}

// 兜底策略(NVIDIA GPU 可用): 走硬件编码器, 实测比 libx264 medium 快约 6 倍
const NVENC_STRATEGY: ContainerEncodingStrategy = {
  buildAudioArgs: () => ['-c:a', 'copy'],
  buildVideoArgs: (crf) => ['-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', String(crf), '-pix_fmt', 'yuv420p'],
  defaultCrf: 23,
  extensions: [],
}

// 兜底策略(无硬件编码器): 走软件 libx264
const LIBX264_STRATEGY: ContainerEncodingStrategy = {
  buildAudioArgs: () => ['-c:a', 'copy'],
  // yuv420p 保证在各种播放器/浏览器上都能正常解码
  buildVideoArgs: (crf) => ['-c:v', 'libx264', '-preset', 'fast', '-crf', String(crf), '-pix_fmt', 'yuv420p'],
  defaultCrf: 23,
  extensions: [],
}

// 按扩展名登记的容器策略(未登记的容器走下面的兜底策略)
const CONTAINER_STRATEGIES = [WEBM_STRATEGY]

// 先按输出容器扩展名查登记表; 未登记时再按硬件编码器可用性在 NVENC / libx264 间二选一
function resolveEncodingStrategy(outputPath: string, isNvencUsable: boolean): ContainerEncodingStrategy {
  const extension = extname(outputPath).toLowerCase()
  const registered = CONTAINER_STRATEGIES.find((strategy) => strategy.extensions.includes(extension))
  if (registered) return registered

  return isNvencUsable ? NVENC_STRATEGY : LIBX264_STRATEGY
}
// #endregion

// #region NVENC 可用性探测
// 探测结果缓存, 避免同一进程内重复试探
let isNvencAvailable: null | boolean = null

// 用最小输入试编一帧, 退出码为 0 即视为可用(无 NVIDIA GPU 或驱动过旧时会失败)
async function detectNvencAvailability(ffmpegPath: string): Promise<boolean> {
  if (isNvencAvailable !== null) return isNvencAvailable

  isNvencAvailable = await new Promise<boolean>((resolve) => {
    const proc = spawn(ffmpegPath, [
      '-v', 'error',
      '-f', 'lavfi', '-i', 'color=black:s=128x128:d=0.1',
      '-c:v', 'h264_nvenc',
      '-f', 'null', '-',
    ])

    proc.on('error', () => resolve(false))
    proc.on('close', (code) => resolve(code === 0))
  })

  return isNvencAvailable
}
// #endregion

// #region 进度显示
const PROGRESS_BAR_WIDTH = 20

interface FfmpegProgressSample {
  processedSeconds: number
  speed: string
}

// 秒 -> HH:MM:SS
function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const remainSeconds = whole % 60

  return [hours, minutes, remainSeconds].map((value) => String(value).padStart(2, '0')).join(':')
}

// 解析 ffmpeg -progress 输出的 key=value 行
// out_time_us 单位是微秒; 部分版本只输出 out_time_ms(值同样是微秒), 故两者都接受
export function parseFfmpegProgress(chunk: string): FfmpegProgressSample | null {
  let processedSeconds: null | number = null
  let speed = ''

  for (const rawLine of chunk.split('\n')) {
    const line = rawLine.trim()

    const microsecondMatch = /^out_time_(?:us|ms)=(\d+)$/.exec(line)
    if (microsecondMatch) processedSeconds = Number(microsecondMatch[1]) / 1_000_000

    const speedMatch = /^speed=\s*([\d.]+x)$/.exec(line)
    if (speedMatch) speed = speedMatch[1]
  }

  return (processedSeconds === null) ? null : {processedSeconds, speed}
}

// 渲染单行进度: 进度条 + 百分比 + 已处理/总时长 + 转码速度
export function renderProgressLine(sample: FfmpegProgressSample, totalSeconds: number): string {
  const speed = sample.speed ? ` ${sample.speed}` : ''
  if (totalSeconds <= 0) {
    // 拿不到总时长时退化为只显示已处理时间与速度
    return `烧写进度: ${formatClock(sample.processedSeconds)}${speed}`
  }

  const ratio = Math.min(1, sample.processedSeconds / totalSeconds)
  const filled = Math.round(ratio * PROGRESS_BAR_WIDTH)
  const bar = `${'='.repeat(filled)}${' '.repeat(PROGRESS_BAR_WIDTH - filled)}`

  return `烧写进度: [${bar}] ${(ratio * 100).toFixed(1)}% ${formatClock(sample.processedSeconds)}/${formatClock(totalSeconds)}${speed}`
}

// 就地刷新单行进度: 每次先抹掉上一次的内容再写新行, 避免新行更短时残留尾部字符
class ProgressLine {
  private readonly isEnabled: boolean
  private lastLength = 0

  constructor(private readonly stream: NodeJS.WriteStream) {
    this.isEnabled = Boolean(stream.isTTY)
  }

  clear(): void {
    if (!this.isEnabled || (this.lastLength === 0)) return

    this.stream.write(`\r${' '.repeat(this.lastLength)}\r`)
    this.lastLength = 0
  }

  update(line: string): void {
    if (!this.isEnabled) return

    this.stream.write(`\r${' '.repeat(this.lastLength)}\r${line}`)
    this.lastLength = line.length
  }
}

// 读取视频总时长, 失败时返回 0 让进度退化为只显示已处理时间
async function readTotalSecondsSafely(videoPath: string): Promise<number> {
  try {
    return await readDuration(videoPath)
  } catch {
    return 0
  }
}
// #endregion

// #region 烧写
// 把字幕像素合成进画面: 视频流必须重编码, 音频流按容器约束决定复制或重编码
// subtitles 数组中每条字幕独立样式, 按顺序生成 subtitles 滤镜串联(可各自指定位置/字号/透明度)
export async function burnSubtitle(
  videoPath: string,
  subtitles: readonly SubtitleInput[],
  options: BurnSubtitleOptions = {},
  logger?: {log: (message: string) => void},
): Promise<string> {
  const ffmpegPath = helpers.findFFmpegBinary()
  if (!ffmpegPath) {
    throw new Error('未找到 ffmpeg, 无法烧写字幕')
  }

  const outputPath = options.outputPath ?? buildBurnedPath(videoPath)
  const filter = subtitles.map((subtitle) => buildSubtitleFilter(subtitle.path, subtitle.style)).join(',')
  // 目标容器的编解码器约束决定音视频参数(如 WebM 只接受 AV1/VP9/Opus)
  const isNvencUsable = await detectNvencAvailability(ffmpegPath)
  const strategy = resolveEncodingStrategy(outputPath, isNvencUsable)
  const crf = options.crf ?? strategy.defaultCrf
  const sourceAudioCodec = await readAudioCodec(videoPath)
  const totalSeconds = await readTotalSecondsSafely(videoPath)
  const progressLine = new ProgressLine(options.progressStream ?? process.stdout)

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      // -v error 屏蔽编码过程中的进度输出, 只保留真正的错误
      '-v', 'error',
      '-y',
      '-i', videoPath,
      // 用 subtitles 滤镜把字幕渲染进画面, 因此视频必须重编码
      '-vf', filter,
      ...strategy.buildVideoArgs(crf),
      ...strategy.buildAudioArgs(sourceAudioCodec),
      // 把结构化进度写到 stdout, 由进度行就地刷新; -nostats 关闭 stderr 的统计输出
      '-progress', 'pipe:1',
      '-nostats',
      outputPath,
    ])

    let stderr = ''
    proc.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    // #region 进度刷新
    proc.stdout.on('data', (chunk: Buffer) => {
      const sample = parseFfmpegProgress(chunk.toString())
      if (!sample) return

      progressLine.update(renderProgressLine(sample, totalSeconds))
    })
    // #endregion

    proc.on('error', reject)
    proc.on('close', (code) => {
      progressLine.clear()
      if (code === 0) {
        logger?.log(`已生成: ${outputPath}`)
        resolve(outputPath)
      } else {
        reject(new Error(`ffmpeg 烧写字幕失败 (退出码 ${code}): ${stderr.trim()}`))
      }
    })
  })
}
// #endregion