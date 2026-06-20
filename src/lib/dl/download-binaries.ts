import {helpers} from 'ytdlp-nodejs'

export async function downloadBinaries(log: (msg: string) => void): Promise<void> {
  // 下载 yt-dlp 二进制到默认目录
  log('开始下载 yt-dlp 二进制...')
  const ytdlpPath = await helpers.downloadYtDlp()
  log(`yt-dlp 已下载到: ${ytdlpPath}`)

  // ffmpeg 体积较大, 用于音视频合并、转码等场景
  log('开始下载 ffmpeg (体积较大，请耐心等待)...')
  const ffmpegPath = await helpers.downloadFFmpeg()
  log(`ffmpeg 已下载到: ${ffmpegPath ?? '(下载失败或已存在)'}`)

  log(`二进制默认目录 BIN_DIR: ${helpers.BIN_DIR}`)
}
