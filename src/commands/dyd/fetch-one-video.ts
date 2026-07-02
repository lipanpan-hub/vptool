import {Args, Command, Flags} from '@oclif/core'

import {FetchVideoWorkflow} from '../../lib/dyd/fetch-video-workflow.js'
import {providers} from '../../lib/dyd/tikhub-providers.js'

export default class DydFetchOneVideo extends Command {
  static aliases = ["dyd:fov"]
  static args = {
    input: Args.string({description: '抖音视频链接或分享文案', required: true}),
  }
  static description = '解析并下载单个抖音视频(通过 TikHub 接口), 下载后自动抽取音频'
  static examples = [
    '<%= config.bin %> <%= command.id %> https://v.douyin.com/xxxxxxx/',
    '<%= config.bin %> <%= command.id %> "8.99 复制打开抖音 https://v.douyin.com/xxxxxxx/ ..."',
    '<%= config.bin %> <%= command.id %> https://v.douyin.com/xxxxxxx/ --provider app-v3',
  ]
  static flags = {
    'keep-audio': Flags.boolean({
      char: 'k',
      default: true,
      description: '下载视频后额外抽取一份 mp3 音频(需要 ffmpeg)',
    }),
    output: Flags.string({
      char: 'o',
      description: '输出目录(默认为配置文件中的 documentsPath)',
    }),
    provider: Flags.string({
      char: 'p',
      description: '指定解析接口(不指定则进入交互式选择菜单)',
      options: providers.map((p) => p.id),
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(DydFetchOneVideo)

    try {
      // 命令层只负责组装参数并委托给门面, 具体编排见 FetchVideoWorkflow
      const workflow = new FetchVideoWorkflow(
        args.input,
        {keepAudio: flags['keep-audio'], output: flags.output, provider: flags.provider},
        this.config.configDir,
        this,
      )
      await workflow.execute()
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error))
    }
  }
}
