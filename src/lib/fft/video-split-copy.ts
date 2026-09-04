import {spawn} from 'node:child_process'
import {helpers} from 'ytdlp-nodejs'

export function parseTimeToSeconds(input: string): number {
  // 支持三种写法: 纯秒 "90" / "MM:SS" / "HH:MM:SS"(可带小数秒)
  const parts = input.trim().split(':').map(Number)
  if (parts.length === 0 || parts.some((num) => Number.isNaN(num))) {
    throw new Error(`时间格式无效: ${input}`)
  }

  // 从右往左依次是 秒/分/时, 权重为 60 的幂
  return parts.reverse().reduce((total, value, index) => total + (value * (60 ** index)), 0)
}

export async function videoSplitCopy(
  videoPath: string,
  start: string,
  end: string,
  logger?: {log: (message: string) => void},
): Promise<string> {
  // 无损快速切割: -c copy 不重编码, 直接拷贝原始音视频流
  const ffmpegPath = helpers.findFFmpegBinary()
  if (!ffmpegPath) {
    throw new Error('未找到 ffmpeg, 无法切割视频')
  }

  // 用秒数拼接输出名(保留原扩展名), 避免时间串里的冒号成为非法文件名字符
  const startSec = parseTimeToSeconds(start)
  const endSec = parseTimeToSeconds(end)
  const outputPath = videoPath.replace(/(\.[^.]+)$/, `.cut_${startSec}-${endSec}s$1`)

  return new Promise((resolve, reject) => {
    // -ss/-to 置于 -i 之前做输入定位, 配合 -c copy 才能实现无损快速切割
    // -avoid_negative_ts make_zero 修正切割起点的时间戳, 避免开头黑屏/音画不同步
    const proc = spawn(ffmpegPath, [
      '-y', '-ss', start, '-to', end, '-i', videoPath,
      '-c', 'copy', '-avoid_negative_ts', 'make_zero', outputPath,
    ])
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) {
        logger?.log(`已生成: ${outputPath}`)
        resolve(outputPath)
      } else {
        reject(new Error(`ffmpeg 切割视频失败 (退出码 ${code})`))
      }
    })
  })
}
