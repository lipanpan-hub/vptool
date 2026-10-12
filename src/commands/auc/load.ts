import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../lib/base-command.js'
import {AudioCppClient, type LoadModelRequest} from '../../lib/auc/audiocpp-client.js'
import {locatePackage, parseSessionOptions, resolvePackageDir} from '../../lib/auc/model-locator.js'
import {ToolConfigManager} from '../../lib/config/index.js'

export default class AucLoad extends BaseCommand {
  static description = '装载模型到 audiocpp_server(从模型包目录自动推导 family/task/权重路径)'

  static examples = [
    '<%= config.bin %> <%= command.id %> E:/tools/audiocpp/models/Qwen3-ASR-1.7B-GGUF',
    '<%= config.bin %> <%= command.id %> E:/tools/audiocpp/models/IndexTTS2-GGUF',
    '<%= config.bin %> <%= command.id %> E:/tools/audiocpp/models/AuK-Base-and-Flash-GGUF --package auk_qwen_q8_0 --set some.option=value',
  ]

  static args = {
    // audiocpp models 目录下的模型包目录(内含 .audiocpp-package-*.json 与 .gguf 权重)
    dir: Args.string({description: '模型包目录', required: true}),
  }

  static flags = {
    // 同一目录含多个包(如 AuK)时用于指定
    package: Flags.string({description: '包 id(目录内含多个包时必填)'}),
    // 覆盖默认的模型 id(默认取 spec 的 family)
    id: Flags.string({description: '模型 id(默认取 family)'}),
    // 透传 session_options, 可重复
    set: Flags.string({description: 'session_options 键值对 key=value, 可重复', multiple: true}),
    port: Flags.integer({description: '服务监听端口(需与启动时一致)', default: 8080}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(AucLoad)

    const audioCppDir = ToolConfigManager.fromConfigDir(this.config.configDir).getAudioCppDir()
    if (audioCppDir === null) {
      this.error('未配置 audiocpp 目录, 请先执行: vp auc cfset <audiocpp目录>')
    }

    // #region 解析包信息与装载参数
    const packageDir = resolvePackageDir(audioCppDir, args.dir)
    const targetPackage = locatePackage(audioCppDir, packageDir, flags.package)
    const sessionOptions = parseSessionOptions(flags.set ?? [])
    // #endregion

    const client = new AudioCppClient({baseUrl: `http://127.0.0.1:${flags.port}`})
    const loadRequest: LoadModelRequest = {
      id: flags.id ?? targetPackage.spec.family,
      path: targetPackage.weightsPath,
      family: targetPackage.spec.family,
      task: targetPackage.spec.tasks[0],
      // 服务端字段为 snake_case, 无法改名
      // eslint-disable-next-line camelcase
      session_options: Object.keys(sessionOptions).length > 0 ? sessionOptions : undefined,
    }

    this.log(`正在装载: id=${loadRequest.id} task=${loadRequest.task} path=${loadRequest.path}`)
    const loadResult = await client.loadModel(loadRequest)
    this.log(`装载完成: id=${loadResult.id} loaded=${loadResult.loaded}`)
  }
}
