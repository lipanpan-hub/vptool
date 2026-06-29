import {spawn} from 'node:child_process'
import {helpers} from 'ytdlp-nodejs'

export async function extractAudioCopy(
  videoPath: string,
  logger?: {log: (message: string) => void},
): Promise<string> {
  // 不重编码, 直接 copy 原始音频流到 m4a, 输出到同目录同名文件
  const ffmpegPath = helpers.findFFmpegBinary()
  if (!ffmpegPath) {
    throw new Error('未找到 ffmpeg, 无法抽取音频')
  }

  const audioPath = videoPath.replace(/\.[^.]+$/, '.m4a')

  return new Promise((resolve, reject) => {
    // -vn 丢弃视频流, -acodec copy 保持原始音频流不重新编码
    const proc = spawn(ffmpegPath, [
      '-y', '-i', videoPath, '-vn', '-acodec', 'copy', audioPath,
    ])
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) {
        logger?.log(`已生成: ${audioPath}`)
        resolve(audioPath)
      } else {
        reject(new Error(`ffmpeg 抽取音频失败 (退出码 ${code})`))
      }
    })
  })
}
