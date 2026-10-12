import {Args, Flags} from '@oclif/core'
import prompts from 'prompts'

import {BaseCommand} from '../../lib/base-command.js'
import {AudioCppClient, type LoadModelRequest, type ModelInfo} from '../../lib/auc/audiocpp-client.js'
import {listModelCandidates, locateAlignerPackage, locatePackage, resolvePackageDir, type ModelCandidate} from '../../lib/auc/model-locator.js'
import {ToolConfigManager} from '../../lib/config/index.js'

export default class AucUse extends BaseCommand {
  static description = '一键切换加载的模型(卸载全部已加载模型后装载目标模型; 切换到 ASR 模型时自动伴随装载对齐模型; 不传目录时交互式选择)'

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

    // #region 卸载全部已加载模型(显存有限, 切换即换装)
    const loadedModels = (await client.listModels()).filter((model) => model.loaded)
    if (loadedModels.length === 0) {
      this.log('当前没有已加载的模型')
    }
    for (const loadedModel of loadedModels) {
      // eslint-disable-next-line no-await-in-loop -- 逐个卸载需按服务端顺序确认
      await client.unloadModel(loadedModel.id)
      this.log(`已卸载: ${loadedModel.id} (task=${loadedModel.task})`)
    }
    // #endregion

    // #region 装载目标模型; ASR 场景伴随装载对齐模型
    // qwen3_asr 的逐词时间戳依赖独立对齐模型, 沿用服务包内既有脚本的 session_options 模式
    const isAsrTarget = targetModel.task === 'asr'
    const alignerPackage = isAsrTarget ? locateAlignerPackage(audioCppDir) : null

    const loadRequest: LoadModelRequest = {
      id: targetModel.family,
      path: targetModel.weightsPath,
      family: targetModel.family,
      task: targetModel.task,
      // 服务端字段为 snake_case, 无法改名
      // eslint-disable-next-line camelcase
      session_options: (isAsrTarget && (alignerPackage !== null))
        ? {[`${targetModel.family}.forced_aligner_model_path`]: alignerPackage.weightsPath}
        : undefined,
    }

    this.log(`正在装载: id=${loadRequest.id} task=${loadRequest.task} path=${loadRequest.path}`)
    await client.loadModel(loadRequest)

    if (isAsrTarget && (alignerPackage !== null)) {
      this.log(`正在装载对齐模型: id=${alignerPackage.spec.family} path=${alignerPackage.weightsPath}`)
      await client.loadModel({
        id: alignerPackage.spec.family,
        path: alignerPackage.weightsPath,
        family: alignerPackage.spec.family,
        task: alignerPackage.spec.tasks[0],
      })
    } else if (isAsrTarget) {
      this.log('未找到对齐模型包, 已跳过(vp auc sub 需要对齐模型, 请用 vp auc load 单独装载)')
    }
    // #endregion

    // #region 输出切换后的装载清单
    const loadedAfterSwitch = (await client.listModels()).filter((model) => model.loaded)
    this.log(`当前已加载 ${loadedAfterSwitch.length} 个模型:`)
    for (const model of loadedAfterSwitch) {
      this.log(formatLoadedLine(model))
    }
    // #endregion
  }
}

// 交互式列出 models 下全部可装载模型供用户选择
async function selectModelInteractively(audioCppDir: string): Promise<ModelCandidate> {
  const candidates = listModelCandidates(audioCppDir)
  if (candidates.length === 0) {
    throw new Error(`models 目录下没有可装载的模型包: ${audioCppDir}`)
  }

  const response = await prompts({
    type: 'select',
    name: 'candidateIndex',
    message: '请选择要加载的模型:',
    choices: candidates.map((candidate) => ({
      // 包元数据里的权重 key 可能带子目录前缀, 展示取文件名
      title: `${candidate.family} [${candidate.task}] (${candidate.directoryName}/${basenameOf(candidate.weightFileName)})`,
      value: candidate,
    })),
  })

  if (response.candidateIndex === undefined) {
    throw new Error('未选择模型, 已取消')
  }
  return response.candidateIndex as ModelCandidate
}

// 传了目录参数时按目录直通解析
function selectModelByDirectory(audioCppDir: string, dirArgument: string, packageIdFlag?: string): ModelCandidate {
  const packageDir = resolvePackageDir(audioCppDir, dirArgument)
  const targetPackage = locatePackage(audioCppDir, packageDir, packageIdFlag)
  return {
    directoryName: basenameOf(packageDir),
    packageId: targetPackage.packageId,
    family: targetPackage.spec.family,
    task: targetPackage.spec.tasks[0],
    weightFileName: basenameOf(targetPackage.weightsPath),
    weightsPath: targetPackage.weightsPath,
  }
}

function formatLoadedLine(model: ModelInfo): string {
  return `  - ${model.id} (task=${model.task})`
}

// 取路径的最后一段(兼容 / 与 \ 分隔)
function basenameOf(pathValue: string): string {
  return pathValue.split(/[\\/]/).pop() ?? pathValue
}
