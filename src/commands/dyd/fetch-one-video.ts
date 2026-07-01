import {Args, Command, Flags} from '@oclif/core'
import {join} from 'node:path'
import prompts from 'prompts'

import {readDocumentsDir, readTikHubToken, writeTikHubToken} from '../../lib/config/read-config.js'
import {selectPrefix} from '../../lib/dl/select-prefix.js'
import {parseDouyinInput} from '../../lib/dyd/input.js'
import {findDouyinVideoProvider, selectDouyinVideoProvider} from '../../lib/dyd/providers.js'
import {fetchDouyinVideoData} from '../../lib/dyd/tikhub.js'
import {downloadResolvedDouyinVideo, resolveBestDouyinVideo, sanitizeFilename} from '../../lib/dyd/video-download.js'
import {extractAudioCopy} from '../../lib/fft/extract-audio-copy.js'

export default class DydFetchOneVideo extends Command {
  static aliases = ['dyd:fetch-one-video', 'dyd:fov']  
  static args = {
    input: Args.string({
      description: '抖音链接、分享信息或 aweme_id',
      required: true,
    }),
  }
  static description = '通过 TikHub provider 解析并下载单个抖音视频'
  static examples = [
    '<%= config.bin %> <%= command.id %> "https://www.douyin.com/video/7123456789012345678"',
    '<%= config.bin %> <%= command.id %> "复制打开抖音分享链接 ..."',
    '<%= config.bin %> <%= command.id %> 7123456789012345678 --provider app-v3',
  ]
  static flags = {
    output: Flags.string({
      char: 'o',
      description: '输出目录（默认为配置文件中的 documentsPath）',
    }),
    provider: Flags.string({
      char: 'p',
      description: '解析接口 provider ID；不传时交互式选择',
      options: ['app-v1', 'app-v2', 'app-v3', 'app-share-url', 'web-share-url', 'web-v2', 'web-v1'],
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(DydFetchOneVideo)
    const parsedInput = parseDouyinInput(args.input)
    const baseOutputDir = flags.output || readDocumentsDir(this.config.configDir) || '.'

    try {
      const provider = flags.provider
        ? findDouyinVideoProvider(flags.provider)
        : await selectDouyinVideoProvider(parsedInput)

      if (!provider) {
        throw new Error(`未知 provider: ${flags.provider}`)
      }

      const token = await this.getTikHubToken()
      const prefix = await selectPrefix(this.config.configDir)

      this.log(`正在使用 provider: ${provider.id}`)
      const data = await fetchDouyinVideoData(provider, parsedInput, token)
      const video = resolveBestDouyinVideo(data)
      this.log(`已解析视频: ${video.title}`)

      const outputDir = join(baseOutputDir, prefix, 'douyin.com', sanitizeFilename(video.title))
      const filepath = await downloadResolvedDouyinVideo(video, outputDir, this)
      this.log(`\n✅ 下载完成: ${filepath}`)
      const audioPath = await extractAudioCopy(filepath, this)
      this.log(`✅ 音频抽取完成: ${audioPath}`)
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error))
    }
  }

  private async getTikHubToken(): Promise<string> {
    const existingToken = readTikHubToken(this.config.configDir)
    if (existingToken) return existingToken

    const response = await prompts({
      message: '请输入 TikHub bearer token（将保存到 config.yml 的 TIKHUB_IO_TOKEN）:',
      name: 'token',
      type: 'password',
    })

    const token = typeof response.token === 'string' ? response.token.trim() : ''
    if (!token) {
      throw new Error('未提供 TikHub bearer token')
    }

    writeTikHubToken(this.config.configDir, token)
    return token
  }
}
