
import {Args, Command, Flags} from '@oclif/core'

import {displayVideoInfo} from '../../lib/dl/vmeta-display.js'
import {fetchVideoInfo} from '../../lib/dl/fetch-video-info.js'
import {formatVideoError} from '../../lib/dl/handle-fetch-error.js'

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
      const videoInfo = await fetchVideoInfo(videoUrl, useCookies)
      displayVideoInfo(videoInfo, this)
    } catch (error) {
      this.error(formatVideoError(error, useCookies, 'fetch'))
    }
  }
}
