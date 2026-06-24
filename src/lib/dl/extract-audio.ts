import {spawn} from 'node:child_process'
import {helpers} from 'ytdlp-nodejs'

export async function extractAudioToMp3(
  videoPath: string,
  logger?: {log: (message: string) => void},
): Promise<string> {
  // 从已合并的成品视频中抽取一份 mp3, 输出到同目录同名文件
  const ffmpegPath = helpers.findFFmpegBinary()
  if (!ffmpegPath) {
    throw new Error('未找到 ffmpeg, 无法抽取音频')
  }

  const mp3Path = videoPath.replace(/\.[^.]+$/, '.mp3')

  return new Promise((resolve, reject) => {
    // -vn 丢弃视频流, libmp3lame 编码为 mp3, -q:a 2 为高质量 VBR
    const proc = spawn(ffmpegPath, [
      '-y', '-i', videoPath, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', mp3Path,
    ])
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(mp3Path)
      } else {
        reject(new Error(`ffmpeg 抽取音频失败 (退出码 ${code})`))
      }
    })
  })
}
