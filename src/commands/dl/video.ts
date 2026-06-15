import {Args, Command, Flags} from '@oclif/core'

import {readDocumentsDir} from '../../lib/config/read-config.js'
import {downloadVideo} from '../../lib/dl/download-video.js'
import {fetchVideoInfo} from '../../lib/dl/fetch-video-info.js'
import {selectFormat} from '../../lib/dl/select-format.js'
import {formatVideoError} from '../../lib/dl/handle-fetch-error.js'

export default class DlVideo extends Command {
  static args = {
    url: Args.string({description: '视频链接', required: true}),
  }

  static description = '下载视频（支持交互式选择格式）'

  static examples = [
    '<%= config.bin %> <%= command.id %> https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    '<%= config.bin %> <%= command.id %> https://www.bilibili.com/video/BV1xx411c7mu -o ~/Downloads',
    '<%= config.bin %> <%= command.id %> https://www.youtube.com/watch?v=dQw4w9WgXcQ --format-id 22',
    '<%= config.bin %> <%= command.id %> https://www.youtube.com/watch?v=dQw4w9WgXcQ --best',
    '<%= config.bin %> <%= command.id %> https://www.youtube.com/watch?v=dQw4w9WgXcQ --best --keep-audio',
  ]

  static flags = {
    best: Flags.boolean({
      char: 'b',
      default: false,
      description: '直接下载最优视频+最优音频并合并（跳过交互式选择，需要 ffmpeg）',
    }),
    'format-id': Flags.string({
      char: 'f',
      description: '指定格式ID（跳过交互式选择）',
    }),
    'keep-audio': Flags.boolean({
      char: 'k',
      default: true,
      description: '在下载视频的同时额外抽取一份 mp3 音频文件（用于语音识别等，需要 ffmpeg）',
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
    const best = flags.best
    const keepAudio = flags['keep-audio']
    
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

      // 选择格式: --best 直接使用最优视频+最优音频合并,否则按指定ID或交互式选择
      let selectedFormatId = formatId
      if (best) {
        selectedFormatId = 'bestvideo+bestaudio/best'
      } else if (!selectedFormatId) {
        selectedFormatId = await selectFormat(videoInfo)
      }

      // 下载视频
      await downloadVideo(videoUrl, {
        extractAudio: keepAudio,
        formatId: selectedFormatId,
        outputDir,
        useCookies,
      }, this)
      
      this.log('\n✅ 下载完成!')
    } catch (error) {
      this.error(formatVideoError(error, useCookies, 'download'))
    }
  }
}
