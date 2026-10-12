import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../lib/base-command.js'
import {AudioCppClient} from '../../lib/auc/audiocpp-client.js'
import {ToolConfigManager} from '../../lib/config/index.js'

export default class AucUnload extends BaseCommand {
  static description = '卸载 audiocpp_server 上的模型以释放显存'

  static examples = ['<%= config.bin %> <%= command.id %> qwen3_asr']

  static args = {
    modelId: Args.string({description: '模型 id(见 vp auc models)', required: true}),
  }

  static flags = {
    port: Flags.integer({description: '服务监听端口(需与启动时一致)', default: 8080}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(AucUnload)

    const audioCppDir = ToolConfigManager.fromConfigDir(this.config.configDir).getAudioCppDir()
    if (audioCppDir === null) {
      this.error('未配置 audiocpp 目录, 请先执行: vp auc cfset <audiocpp目录>')
    }

    const client = new AudioCppClient({baseUrl: `http://127.0.0.1:${flags.port}`})
    await client.unloadModel(args.modelId)
    this.log(`已卸载模型: ${args.modelId}`)
  }
}
