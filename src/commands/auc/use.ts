import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../lib/base-command.js'
import {AudioCppClient} from '../../lib/auc/audiocpp-client.js'
import {selectModelByDirectory} from '../../lib/auc/model-locator.js'
import {replaceLoadedModels, selectModelInteractively} from '../../lib/auc/model-switcher.js'
import {ToolConfigManager} from '../../lib/config/index.js'

export default class AucUse extends BaseCommand {
  static description = '一键切换加载的模型(卸载全部已加载模型后装载目标模型; 目标已装载时跳过; 切换到 ASR 模型时自动伴随装载对齐模型; 不传目录时交互式选择)'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> IndexTTS2-GGUF',
    '<%= config.bin %> <%= command.id %> Qwen3-ASR-1.7B-GGUF',
  ]

  static args = {
    // 可选: models 下的模型包目录名或绝对路径; 缺省时交互式选择
    dir: Args.string({description: '目标模型包目录(缺省进入交互式选择)', required: false}),
  }

  static flags = {
    // 同一目录含多个包(如 AuK)时用于指定
    package: Flags.string({description: '包 id(仅传目录时, 目录内含多个包时必填)'}),
    port: Flags.integer({description: '服务监听端口(需与启动时一致)', default: 8080}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(AucUse)

    const audioCppDir = ToolConfigManager.fromConfigDir(this.config.configDir).getAudioCppDir()
    if (audioCppDir === null) {
      this.error('未配置 audiocpp 目录, 请先执行: vp auc cfset <audiocpp目录>')
    }

    // #region 确定目标模型(交互选择或目录直通)
    const targetModel = (args.dir === undefined)
      ? await selectModelInteractively(audioCppDir)
      : selectModelByDirectory(audioCppDir, args.dir, flags.package)
    // #endregion

    const client = new AudioCppClient({baseUrl: `http://127.0.0.1:${flags.port}`})
    await replaceLoadedModels({audioCppDir, client, log: (message) => this.log(message), target: targetModel})
  }
}
