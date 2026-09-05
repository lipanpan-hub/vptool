import {spawn} from 'node:child_process'
import path from 'node:path'
import {helpers} from 'ytdlp-nodejs'

// #region 类型定义
interface FfprobeStream {
  avg_frame_rate?: string
  bit_rate?: string
  channel_layout?: string
  channels?: number
  codec_long_name?: string
  codec_name?: string
  codec_type?: string
  duration?: string
  height?: number
  index: number
  pix_fmt?: string
  r_frame_rate?: string
  sample_rate?: string
  tags?: Record<string, string>
  width?: number
}

interface FfprobeFormat {
  bit_rate?: string
  duration?: string
  filename?: string
  format_long_name?: string
  format_name?: string
  nb_streams?: number
  size?: string
  tags?: Record<string, string>
}

interface FfprobeResult {
  format: FfprobeFormat
  streams: FfprobeStream[]
}

export interface ProbeLogger {
  log(message: string): void
}
// #endregion

// #region ffprobe 定位与执行
function resolveFfprobePath(): string {
  const ffmpegPath = helpers.findFFmpegBinary()
  if (!ffmpegPath) {
    throw new Error('未找到 ffprobe(需先下载 ffmpeg 套件), 无法查看媒体信息')
  }

  // ffmpeg 与 ffprobe 由 ytdlp-nodejs 成对下载于同一目录, 仅文件名不同
  const dir = path.dirname(ffmpegPath)
  const ext = process.platform === 'win32' ? '.exe' : ''
  return path.join(dir, `ffprobe${ext}`)
}

function runFfprobe(mediaPath: string): Promise<FfprobeResult> {
  const ffprobePath = resolveFfprobePath()

  return new Promise((resolve, reject) => {
    // -show_format 取容器信息, -show_streams 取每条流信息, 统一 json 输出便于解析
    const proc = spawn(ffprobePath, [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      mediaPath,
    ])

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
        resolve(JSON.parse(stdout) as FfprobeResult)
      } else {
        reject(new Error(`ffprobe 执行失败 (退出码 ${code}): ${stderr.trim()}`))
      }
    })
  })
}
// #endregion

// #region 格式化辅助
// 秒 -> HH:MM:SS.s, 输入非法则原样返回
function formatDuration(raw?: string): string {
  if (!raw) return '-'
  const totalSeconds = Number(raw)
  if (Number.isNaN(totalSeconds)) return raw

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = seconds.toFixed(1).padStart(4, '0')
  return `${hh}:${mm}:${ss}`
}

// 字节 -> 人类可读单位(B/KB/MB/GB/TB)
function formatSize(raw?: string): string {
  if (!raw) return '-'
  const bytes = Number(raw)
  if (Number.isNaN(bytes)) return raw

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while ((value >= 1024) && (unitIndex < (units.length - 1))) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`
}

// bps -> kbps / Mbps
function formatBitrate(raw?: string): string {
  if (!raw) return '-'
  const bps = Number(raw)
  if (Number.isNaN(bps)) return raw
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`
  return `${(bps / 1000).toFixed(0)} kbps`
}

// "30000/1001" -> "29.97 fps"
function formatFrameRate(raw?: string): string {
  if (!raw || (raw === '0/0')) return '-'
  const [numerator, denominator] = raw.split('/').map(Number)
  if (!denominator || Number.isNaN(numerator) || Number.isNaN(denominator)) return raw
  return `${(numerator / denominator).toFixed(2)} fps`
}
// #endregion

// #region 人类可读输出
function displayFormat(format: FfprobeFormat, logger: ProbeLogger): void {
  logger.log('\n' + '═'.repeat(60))
  logger.log('📄 文件信息')
  logger.log('═'.repeat(60))
  if (format.filename) logger.log(`文件名: ${format.filename}`)
  if (format.format_long_name || format.format_name) {
    logger.log(`容器格式: ${format.format_long_name || format.format_name}`)
  }

  logger.log(`时长: ${formatDuration(format.duration)}`)
  logger.log(`大小: ${formatSize(format.size)}`)
  logger.log(`总比特率: ${formatBitrate(format.bit_rate)}`)
  if (format.nb_streams !== undefined) logger.log(`流数量: ${format.nb_streams}`)
}

function displayVideoStream(stream: FfprobeStream, logger: ProbeLogger): void {
  logger.log('\n' + '─'.repeat(60))
  logger.log(`🎬 视频流 #${stream.index}`)
  logger.log('─'.repeat(60))
  if (stream.codec_long_name || stream.codec_name) {
    logger.log(`编码: ${stream.codec_long_name || stream.codec_name}`)
  }

  if (stream.width && stream.height) logger.log(`分辨率: ${stream.width}x${stream.height}`)
  logger.log(`帧率: ${formatFrameRate(stream.avg_frame_rate || stream.r_frame_rate)}`)
  if (stream.pix_fmt) logger.log(`像素格式: ${stream.pix_fmt}`)
  logger.log(`比特率: ${formatBitrate(stream.bit_rate)}`)
}

function displayAudioStream(stream: FfprobeStream, logger: ProbeLogger): void {
  logger.log('\n' + '─'.repeat(60))
  logger.log(`🔊 音频流 #${stream.index}`)
  logger.log('─'.repeat(60))
  if (stream.codec_long_name || stream.codec_name) {
    logger.log(`编码: ${stream.codec_long_name || stream.codec_name}`)
  }

  if (stream.sample_rate) logger.log(`采样率: ${stream.sample_rate} Hz`)
  if (stream.channels) {
    // 声道数后面附带声道布局(如 stereo/5.1), 布局缺失时只显示数量
    const layout = stream.channel_layout ? ` (${stream.channel_layout})` : ''
    logger.log(`声道: ${stream.channels}${layout}`)
  }

  logger.log(`比特率: ${formatBitrate(stream.bit_rate)}`)
  if (stream.tags?.language) logger.log(`语言: ${stream.tags.language}`)
}

function displayOtherStream(stream: FfprobeStream, logger: ProbeLogger): void {
  logger.log('\n' + '─'.repeat(60))
  logger.log(`📎 ${stream.codec_type ?? '其他'} 流 #${stream.index}`)
  logger.log('─'.repeat(60))
  if (stream.codec_long_name || stream.codec_name) {
    logger.log(`编码: ${stream.codec_long_name || stream.codec_name}`)
  }

  if (stream.tags?.language) logger.log(`语言: ${stream.tags.language}`)
}

function displayStreams(streams: FfprobeStream[], logger: ProbeLogger): void {
  // 按流类型分发到对应的展示函数(策略选择)
  for (const stream of streams) {
    if (stream.codec_type === 'video') {
      displayVideoStream(stream, logger)
    } else if (stream.codec_type === 'audio') {
      displayAudioStream(stream, logger)
    } else {
      displayOtherStream(stream, logger)
    }
  }
}
// #endregion

// 调用 ffprobe 探测媒体信息并以人类可读方式输出
export async function probeMedia(mediaPath: string, logger: ProbeLogger): Promise<void> {
  const result = await runFfprobe(mediaPath)
  displayFormat(result.format, logger)
  displayStreams(result.streams ?? [], logger)
  logger.log('\n' + '═'.repeat(60))
  logger.log('✅ 媒体信息读取完成')
  logger.log('═'.repeat(60))
}
