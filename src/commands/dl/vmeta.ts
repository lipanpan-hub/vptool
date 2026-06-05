
import {Args, Command, Flags} from '@oclif/core'
import {type VideoInfo, YtDlp} from 'ytdlp-nodejs'

import {displayVideoInfo} from '../../lib/dl/vmeta-display.js'

export default class DlVmeta extends Command {
  static args = {
    url: Args.string({description: '视频链接', required: true}),
  }

  static description = '获取视频元信息'

  static examples = [
    '<%= config.bin %> <%= command.id %> https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    '<%= config.bin %> <%= command.id %> https://www.bilibili.com/video/BV1xx411c7mu',
    '<%= config.bin %> <%= command.id %> https://www.youtube.com/watch?v=dQw4w9WgXcQ --use-cookies',
  ]

  static flags = {
    'use-cookies': Flags.boolean({
      char: 'c',
      default: true,
      description: '从 Firefox 浏览器获取 cookies（用于访问需要登录的内容）',
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(DlVmeta)
    const videoUrl = args.url
    const useCookies = flags['use-cookies']

    this.log(`正在获取视频元信息: ${videoUrl}\n`)
    if (useCookies) {
      this.log('🍪 将使用 Firefox 浏览器的 cookies\n')
    }

    try {
      this.log('正在获取详细信息...')
      const videoInfo = await this.fetchVideoInfo(videoUrl, useCookies)
      displayVideoInfo(videoInfo, this)
    } catch (error) {
      this.handleError(error, useCookies)
    }
  }

  private async fetchVideoInfo(url: string, useCookies: boolean): Promise<VideoInfo> {
    const ytDlp = new YtDlp()
    const options = useCookies ? {cookiesFromBrowser: 'firefox' as const} : {}
    const videoInfo = (await ytDlp.getInfoAsync(url, options)) as VideoInfo
    if (!videoInfo) {
      this.error('无法获取视频信息')
    }
    return videoInfo
  }

  private handleError(error: unknown, useCookies: boolean): never {
    if (useCookies && error instanceof Error) {
      this.error(
        `获取视频信息失败: ${error.message}\n\n` +
          '提示：\n' +
          '  1. 请确保 Firefox 浏览器已安装并已登录相关网站\n' +
          '  2. 尝试先在 Firefox 中访问该视频，确保可以正常观看\n' +
          '  3. 关闭 Firefox 浏览器后再试（某些系统可能需要）',
      )
    }

    this.error(`获取视频信息失败: ${error}`)
  }
}
