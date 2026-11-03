import {Args, Flags} from '@oclif/core'
import {join} from 'node:path'

import {BaseCommand} from '../../lib/base-command.js'
import {ToolConfigManager} from '../../lib/config/index.js'
import {downloadVideo} from '../../lib/dl/download-video.js'
import {fetchVideoInfo} from '../../lib/dl/fetch-video-info.js'
import {selectFormat} from '../../lib/dl/select-format.js'
import {selectPrefix} from '../../lib/dl/select-prefix.js'
import {resolveAutoEnglishSubtitleLang} from '../../lib/dl/select-subtitle.js'
import {spawnShellAt} from '../../lib/dl/spawn-shell.js'
import {formatVideoError} from '../../lib/dl/handle-fetch-error.js'
import {withStdoutToStderr} from '../../lib/dl/redirect-stdout.js'

export default class DlVideo extends BaseCommand {
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
      description: '直接下载最优视频+最优音频并合并（跳过交互式选择，需要 ffmpeg；YouTube 视频自动附带英文字幕，优先 en-orig，缺失回退 en；YouTube 视频自动附带下载视频简介与封面）',
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
    // 注意与 --output 区分: --output 是基目录(还会追加交互选择的 prefix), --output-dir 是最终目录
    'output-dir': Flags.string({
      description: '最终输出目录（指定后跳过交互式 prefix 选择，--json 模式必须使用此项）',
    }),
    output: Flags.string({
      char: 'o',
      description: '输出基目录（在其下追加交互选择的 prefix，默认为配置文件中的 documentsDir）',
    }),
    'use-cookies': Flags.boolean({
      char: 'c',
      default: true,
      description: '从 Firefox 浏览器获取 cookies',
    }),
  }

  public async run(): Promise<{formatId: string; title: string; videoDir?: string}> {
    const {args, flags} = await this.parse(DlVideo)

    const videoUrl = args.url
    const useCookies = flags['use-cookies']
    const formatId = flags['format-id']
    const best = flags.best
    const keepAudio = flags['keep-audio']

    // 最终输出目录: 显式指定 --output-dir 时跳过交互; 否则取基目录(--output 或配置 documentsDir) + 交互选择的 prefix
    const finalOutputDir = flags['output-dir']
    if (!finalOutputDir) {
      this.rejectInteractionInJsonMode('--output-dir <最终输出目录>')
    }
    const baseOutputDir = flags.output || ToolConfigManager.fromConfigDir(this.config.configDir).getDocumentsPath()

    this.log(`正在准备下载视频: ${videoUrl}\n`)
    if (useCookies) {
      this.log('🍪 将使用 Firefox 浏览器的 cookies\n')
    }

    // JSON 模式下把下载进度等对 stdout 的直接写入转写到 stderr, 保持 stdout 只有结果 JSON 信封
    return withStdoutToStderr(this.jsonEnabled(), async () => {
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
          this.rejectInteractionInJsonMode('--format-id <格式ID> 或 --best')
          selectedFormatId = await selectFormat(videoInfo)
        }

        // 输出目录: 已显式指定最终目录则直接使用, 否则在基目录后追加交互选择的 prefix
        let outputDir: string
        if (finalOutputDir) {
          outputDir = finalOutputDir
        } else {
          const prefix = await selectPrefix(this.config.configDir)
          outputDir = join(baseOutputDir, prefix)
        }

        // --best 且为 YouTube 时自动附带英文字幕: 优先 en-orig(原声 ASR), 缺失回退 en
        const autoSubtitleLang = (best && videoInfo.extractor_key === 'Youtube')
          ? resolveAutoEnglishSubtitleLang(videoInfo)
          : undefined

        // --best 且为 YouTube 时自动附带下载视频简介
        const writeDescription = best && videoInfo.extractor_key === 'Youtube'

        // --best 且为 YouTube 时自动附带下载视频封面
        const writeThumbnail = best && videoInfo.extractor_key === 'Youtube'

        // 下载视频, 成功后返回视频所在目录(字幕/mp3/简介等附带产物的同名文件夹)
        const videoDir = await downloadVideo(videoUrl, {
          autoSubtitleLang,
          extractAudio: keepAudio,
          formatId: selectedFormatId,
          outputDir,
          useCookies,
          writeDescription,
          writeThumbnail,
        }, this)

        this.log('\n✅ 下载完成!')

        // 沿用 vp dl cd 的机制: 在视频所在目录直接 spawn 交互式 shell, exit 退出后返回
        // JSON 模式面向程序调用, 跳过交互式子 shell
        if (videoDir && !this.jsonEnabled()) {
          this.log(`\n进入目录: ${videoDir} (输入 exit 退出并返回)`)
          await spawnShellAt(videoDir)
        }

        return {formatId: selectedFormatId, title: videoInfo.title, videoDir}
      } catch (error) {
        this.error(formatVideoError(error, useCookies, 'download'))
      }
    })
  }
}
