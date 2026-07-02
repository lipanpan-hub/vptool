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

// 进度报告器: 单一职责, 仅负责按时间间隔节流刷新下载进度到控制台, 与下载逻辑解耦
class ProgressReporter {
  private downloaded = 0
  private lastLen = 0
  private lastTick = 0
  private readonly start = Date.now()

  constructor(private readonly total: number) {}

  finish(): void {
    // 有过输出才补换行, 避免污染后续日志
    if (this.lastLen > 0) process.stdout.write('\n')
  }

  update(chunkLength: number): void {
    this.downloaded += chunkLength
    const now = Date.now()
    if (now - this.lastTick <= 200) return
    this.lastTick = now

    const mb = (this.downloaded / 1024 / 1024).toFixed(2)
    const speed = (this.downloaded / 1024 / ((now - this.start) / 1000) / 1024).toFixed(2)
    const percent = this.total > 0 ? `${((this.downloaded / this.total) * 100).toFixed(1)}%` : '未知'
    const line = `下载进度: ${percent} | 已下载: ${mb} MB | 速度: ${speed} MB/s`
    process.stdout.write('\r' + ' '.repeat(this.lastLen) + '\r' + line)
    this.lastLen = line.length
  }
}

// 下载器: 依赖注入的 provider 负责解析地址, 本类负责组织路径、落盘与抽音编排
export class DouyinVideoDownloader {
  constructor(
    private readonly provider: DouyinProvider,
    private readonly input: ResolvedInput,
    private readonly options: DownloadDouyinOptions,
    private readonly logger?: Logger,
  ) {}

  async download(): Promise<void> {
    const {extractAudio, outputBaseDir, token} = this.options

    this.logger?.log(`\n正在使用接口 [${this.provider.id}] 解析视频地址...`)
    const video = await this.provider.fetchVideo(this.input, token)
    this.logger?.log(`✓ 视频标题: ${video.desc || video.awemeId}\n`)

    // 路径结构: <base>/<prefix>/douyin.com/<视频名>/<视频名>.mp4
    const name = this.sanitizeName(video.desc || video.awemeId)
    const dir = join(outputBaseDir, 'douyin.com', name)
    mkdirSync(dir, {recursive: true})
    const videoPath = join(dir, `${name}.mp4`)

    this.logger?.log(`保存位置: ${videoPath}\n`)
    await this.fetchToFile(video.videoUrl, videoPath)

    if (extractAudio) {
      this.logger?.log('\n🎵 正在抽取音频...')
      const mp3Path = await extractAudioToMp3(videoPath, this.logger)
      this.logger?.log(`✓ 音频已保存: ${mp3Path}`)
    }
  }

  private async fetchToFile(url: string, dest: string): Promise<void> {
    const res = await fetch(url, {
      headers: {Referer: 'https://www.douyin.com/', 'User-Agent': 'Mozilla/5.0'},
    })
    if (!res.ok || !res.body) {
      throw new Error(`视频下载失败: HTTP ${res.status}`)
    }

    const progress = new ProgressReporter(Number(res.headers.get('content-length')) || 0)
    const file = createWriteStream(dest)
    const reader = res.body.getReader()

    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const {done, value} = await reader.read()
      if (done) break
      file.write(Buffer.from(value))
      progress.update(value.length)
    }

    file.end()
    await new Promise<void>((resolve, reject) => {
      file.on('finish', resolve)
      file.on('error', reject)
    })
    progress.finish()
  }

  private sanitizeName(name: string): string {
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
}
