import {Args, Command, Flags} from '@oclif/core'
import {resolve} from 'node:path'

import {downloadSubtitle} from '../../lib/dl/download-subtitle.js'
import {fetchVideoInfo} from '../../lib/dl/fetch-video-info.js'
import {formatVideoError} from '../../lib/dl/handle-fetch-error.js'
import {selectSubtitleLangs} from '../../lib/dl/select-subtitle.js'

export default class DlSub extends Command {
  static args = {
    url: Args.string({description: '视频链接', required: true}),
  }

  static description = '下载视频字幕（包含自动生成字幕，默认 vtt 格式）'

  static examples = [
    '<%= config.bin %> <%= command.id %> https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    '<%= config.bin %> <%= command.id %> https://www.youtube.com/watch?v=dQw4w9WgXcQ -l en,zh-Hans -o ~/Downloads',
    '<%= config.bin %> <%= command.id %> https://www.youtube.com/watch?v=dQw4w9WgXcQ -l en --no-auto',
  ]

  static flags = {
    auto: Flags.boolean({
      allowNo: true,
      default: true,
      description: '包含自动生成字幕（--no-auto 只下载人工字幕）',
    }),
    lang: Flags.string({
      char: 'l',
      description: '字幕语言代码, 多个用逗号分隔, 如 en,zh-Hans（跳过交互式选择）',
    }),
    output: Flags.string({
      char: 'o',
      description: '输出目录（默认为执行命令时的当前目录）',
    }),
    'use-cookies': Flags.boolean({
      char: 'c',
      default: true,
      description: '从 Firefox 浏览器获取 cookies',
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(DlSub)
    const videoUrl = args.url
    const useCookies = flags['use-cookies']
    const outputDir = resolve(flags.output ?? process.cwd())

    this.log(`正在准备下载字幕: ${videoUrl}\n`)
    if (useCookies) {
      this.log('🍪 将使用 Firefox 浏览器的 cookies\n')
    }

    try {
      // 未指定 --lang 时获取视频信息并交互式选择字幕语言
      let langs = flags.lang?.split(',').map((lang) => lang.trim()).filter(Boolean) ?? []
      if (langs.length === 0) {
        this.log('正在获取视频信息...')
        const videoInfo = await fetchVideoInfo(videoUrl, useCookies)
        this.log(`✓ 视频标题: ${videoInfo.title}\n`)
        langs = await selectSubtitleLangs(videoInfo, flags.auto)
      }

      const subtitlePaths = await downloadSubtitle(videoUrl, {
        isAutoIncluded: flags.auto,
        langs,
        outputDir,
        useCookies,
      }, this)

      if (subtitlePaths.length === 0) {
        this.warn('未下载到任何字幕, 请用 vp dl sub <URL> 不带 -l 查看可用语言')
        return
      }

      this.log(`\n✅ 字幕下载完成, 共 ${subtitlePaths.length} 个文件`)
    } catch (error) {
      this.error(formatVideoError(error, useCookies, 'download'))
    }
  }
}
