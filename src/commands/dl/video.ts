import {Args, Command, Flags} from '@oclif/core'

import {readDocumentsDir} from '../../lib/config/read-config.js'
import {downloadVideo} from '../../lib/dl/download-video.js'
import {fetchVideoInfo} from '../../lib/dl/fetch-video-info.js'
import {selectFormat} from '../../lib/dl/select-format.js'

export default class DlVideo extends Command {
  static args = {
    url: Args.string({description: '视频链接', required: true}),
  }

  static description = '下载视频（支持交互式选择格式）'

  static examples = [
    '<%= config.bin %> <%= command.id %> https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    '<%= config.bin %> <%= command.id %> https://www.bilibili.com/video/BV1xx411c7mu -o ~/Downloads',
    '<%= config.bin %> <%= command.id %> https://www.youtube.com/watch?v=dQw4w9WgXcQ --format-id 22',
  ]

  static flags = {
    'format-id': Flags.string({
      char: 'f',
      description: '指定格式ID（跳过交互式选择）',
    }),
    output: Flags.string({
      char: 'o',
      description: '输出目录（默认为配置文件中的 documentsDir）',
    }),
    'use-cookies': Flags.boolean({
      char: 'c',
      default: true,
      description: '从 Firefox 浏览器获取 cookies',
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(DlVideo)
    const videoUrl = args.url
    const useCookies = flags['use-cookies']
    const formatId = flags['format-id']
    
    // 获取输出目录: 优先使用命令行参数,否则读取配置文件,最后降级到当前目录
    const outputDir = flags.output || readDocumentsDir(this.config.configDir) || '.'

    this.log(`正在准备下载视频: ${videoUrl}\n`)
    if (useCookies) {
      this.log('🍪 将使用 Firefox 浏览器的 cookies\n')
    }

    try {
      // 获取视频信息
      this.log('正在获取视频信息...')
      const videoInfo = await fetchVideoInfo(videoUrl, useCookies)
      this.log(`✓ 视频标题: ${videoInfo.title}\n`)

      // 选择格式
      let selectedFormatId = formatId
      if (!selectedFormatId) {
        selectedFormatId = await selectFormat(videoInfo)
      }

      // 下载视频
      await downloadVideo(videoUrl, {
        formatId: selectedFormatId,
        outputDir,
        useCookies,
      }, this)
      
      this.log('\n✅ 下载完成!')
    } catch (error) {
      this.handleError(error, useCookies)
    }
  }

  private handleError(error: unknown, useCookies: boolean): never {
    if (useCookies && error instanceof Error) {
      this.error(
        `下载失败: ${error.message}\n\n` +
          '提示：\n' +
          '  1. 请确保 Firefox 浏览器已安装并已登录相关网站\n' +
          '  2. 尝试先在 Firefox 中访问该视频，确保可以正常观看\n' +
          '  3. 关闭 Firefox 浏览器后再试（某些系统可能需要）\n' +
          '  4. 或使用 --no-use-cookies 跳过 cookies',
      )
    }

    this.error(`下载失败: ${error}`)
  }
}
