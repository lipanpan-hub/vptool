import {createWriteStream, mkdirSync} from 'node:fs'
import {join} from 'node:path'

import type {DouyinProvider, ResolvedInput} from './provider.js'

import {extractAudioToMp3} from '../dl/extract-audio.js'

export interface DownloadDouyinOptions {
  // 下载视频后额外抽取一份 mp3 音频
  extractAudio: boolean
  // prefix 之后的输出根目录, 域名与视频名目录会在其下创建
  outputBaseDir: string
  token: string
}

interface Logger {
  log: (message: string) => void
}

function sanitizeName(name: string): string {
  // 先去除 # 开头的话题标签, 再清理非法字符与换行, 折叠空白并限制长度
  const cleaned = name
    .replaceAll(/#\S+/g, ' ')
    .replaceAll(/[\\/:*?"<>|\n\r\t]/g, '_')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim()
  return cleaned || 'douyin_video'
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url, {
    headers: {Referer: 'https://www.douyin.com/', 'User-Agent': 'Mozilla/5.0'},
  })
  if (!res.ok || !res.body) {
    throw new Error(`视频下载失败: HTTP ${res.status}`)
  }

  const total = Number(res.headers.get('content-length')) || 0
  const file = createWriteStream(dest)
  const reader = res.body.getReader()
  const start = Date.now()
  let downloaded = 0
  let lastTick = 0
  let lastLen = 0

  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const {done, value} = await reader.read()
    if (done) break
    file.write(Buffer.from(value))
    downloaded += value.length

    // 按时间间隔节流刷新进度, 避免刷屏
    const now = Date.now()
    if (now - lastTick > 200) {
      lastTick = now
      const mb = (downloaded / 1024 / 1024).toFixed(2)
      const speed = (downloaded / 1024 / ((now - start) / 1000) / 1024).toFixed(2)
      const percent = total > 0 ? `${((downloaded / total) * 100).toFixed(1)}%` : '未知'
      const line = `下载进度: ${percent} | 已下载: ${mb} MB | 速度: ${speed} MB/s`
      process.stdout.write('\r' + ' '.repeat(lastLen) + '\r' + line)
      lastLen = line.length
    }
  }

  file.end()
  await new Promise<void>((resolve, reject) => {
    file.on('finish', resolve)
    file.on('error', reject)
  })
  if (lastLen > 0) process.stdout.write('\n')
}

// 下载器: 依赖注入的 provider 负责解析地址, 本函数负责组织路径与落盘
export async function downloadDouyinVideo(
  provider: DouyinProvider,
  input: ResolvedInput,
  options: DownloadDouyinOptions,
  logger?: Logger,
): Promise<void> {
  const {extractAudio, outputBaseDir, token} = options

  logger?.log(`\n正在使用接口 [${provider.id}] 解析视频地址...`)
  const video = await provider.fetchVideo(input, token)
  logger?.log(`✓ 视频标题: ${video.desc || video.awemeId}\n`)

  // 路径结构: <base>/<prefix>/douyin.com/<视频名>/<视频名>.mp4
  const name = sanitizeName(video.desc || video.awemeId)
  const dir = join(outputBaseDir, 'douyin.com', name)
  mkdirSync(dir, {recursive: true})
  const videoPath = join(dir, `${name}.mp4`)

  logger?.log(`保存位置: ${videoPath}\n`)
  await downloadFile(video.videoUrl, videoPath)

  if (extractAudio) {
    logger?.log('\n🎵 正在抽取音频...')
    const mp3Path = await extractAudioToMp3(videoPath, logger)
    logger?.log(`✓ 音频已保存: ${mp3Path}`)
  }
}
