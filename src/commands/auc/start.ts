import {Flags} from '@oclif/core'
import {resolve} from 'node:path'
import prompts from 'prompts'

import {BaseCommand} from '../../lib/base-command.js'
import {AudioCppClient, type ModelInfo} from '../../lib/auc/audiocpp-client.js'
import {AudioCppServerManager} from '../../lib/auc/audiocpp-server-manager.js'
import {selectModelByDirectory, type ModelCandidate} from '../../lib/auc/model-locator.js'
import {replaceLoadedModels, selectModelInteractively} from '../../lib/auc/model-switcher.js'
import {ToolConfigManager} from '../../lib/config/index.js'

// --json 模式下的 data 结构
interface StartResult {
  backend: string
  baseUrl: string
  isAlreadyRunning: boolean
  loadedModels: ModelInfo[]
  logFilePath: string
  target: ModelCandidate
}

export default class AucStart extends BaseCommand {
  static aliases = ['auc:start','auc:run']
  static description = '后台启动 audiocpp_server 服务并等待就绪(服务目录取配置档案的 audioCppDir 字段); 就绪后装载指定模型(已加载的其他模型先卸载, 目标已装载则跳过), 未指定 --model 时交互式选择'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --port 8081 --backend cpu',
    '<%= config.bin %> <%= command.id %> --model Qwen3-ASR-1.7B-GGUF',
  ]

  static flags = {
    port: Flags.integer({description: '服务监听端口', default: 8080}),
    backend: Flags.string({description: '计算后端', default: 'cuda'}),
    model: Flags.string({description: '就绪后装载的模型包目录(models 下目录名或绝对路径), 已加载的其他模型会先卸载; 缺省进入交互式选择'}),
    // 同一目录含多个包(如 AuK)时用于指定
    package: Flags.string({description: '包 id(仅 --model 目录内含多个包时必填)'}),
  }

  public async run(): Promise<StartResult> {
    const {flags} = await this.parse(AucStart)

    const audioCppDir = ToolConfigManager.fromConfigDir(this.config.configDir).getAudioCppDir()
    if (audioCppDir === null) {
      this.error('未配置 audiocpp 目录, 请先执行: vp auc cfset <audiocpp目录>')
    }

    // 统一转绝对路径, 避免相对路径在不同工作目录下语义漂移
    const resolvedAudioCppDir = resolve(audioCppDir)
    const manager = new AudioCppServerManager({audioCppDir: resolvedAudioCppDir, port: flags.port, backend: flags.backend})

    // #region 前置检查
    try {
      manager.checkPrerequisites()
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error))
    }

    // --model 传了就先定位目标模型, 目录无效时在启动服务前快速失败; 未传则后面要交互选择, JSON 模式提前拒绝
    let directTargetModel: ModelCandidate | null = null
    if (flags.model === undefined) this.rejectInteractionInJsonMode('--model <模型包目录>')
    if (flags.model !== undefined) {
      try {
        directTargetModel = selectModelByDirectory(resolvedAudioCppDir, flags.model, flags.package)
      } catch (error) {
        this.error(error instanceof Error ? error.message : String(error))
      }
    }
    // #endregion

    // #region 端口冲突处理: 服务未就绪但端口被其他进程占用时, 展示占用信息并询问是否杀掉
    if ((await manager.fetchHealth()) === null) {
      await this.resolvePortConflict(manager, flags.port)
    }
    // #endregion

    // #region 启动并输出结果
    const startResult = await manager.start()
    if (startResult.kind === 'already-running') {
      this.log(`服务已在运行, 复用现有进程: ${manager.baseUrl}`)
    } else {
      this.log(`服务就绪: backend=${startResult.health.backend}`)
      this.log(`服务地址: ${manager.baseUrl}`)
      this.log(`日志文件: ${manager.logFilePath}`)
    }
    // #endregion

    // #region 就绪后换装到目标模型: 传 --model 直通, 未传交互式选择(卸载其他已加载模型, 目标已装载则跳过)
    const targetModel = directTargetModel ?? await selectModelInteractively(resolvedAudioCppDir)
    const client = new AudioCppClient({baseUrl: manager.baseUrl})
    await replaceLoadedModels({audioCppDir: resolvedAudioCppDir, client, log: (message) => this.log(message), target: targetModel})

    const loadedModels = (await client.listModels()).filter((model) => model.loaded)
    return {
      backend: startResult.health.backend,
      baseUrl: manager.baseUrl,
      isAlreadyRunning: (startResult.kind === 'already-running'),
      loadedModels,
      logFilePath: manager.logFilePath,
      target: targetModel,
    }
    // #endregion
  }

  // 端口被占用时输出占用进程信息, 用户确认后杀掉; 拒绝或无法交互则终止启动
  private async resolvePortConflict(manager: AudioCppServerManager, port: number): Promise<void> {
    const occupier = manager.findPortOccupier()
    if (occupier === null) {
      return
    }

    this.log(`端口 ${port} 已被其他进程占用:`)
    this.log(`  进程名: ${occupier.name} (pid=${occupier.processId})`)
    this.log(`  连接状态: ${occupier.state ?? '未知'}`)
    this.log(`  程序路径: ${occupier.path ?? '未知(权限不足)'}`)
    this.log(`  命令行: ${occupier.commandLine ?? '未知'}`)

    this.rejectInteractionInJsonMode('--port <其他可用端口>(端口被占用, 杀进程需要交互确认)')

    // Agent 终端不是 TTY, 无法应答确认, 直接报错并提示换端口
    if (!process.stdin.isTTY) {
      this.error(`非交互环境无法确认是否杀进程, 请换端口(--port)或手动结束 pid=${occupier.processId}`)
    }

    const {isConfirmed} = await prompts({
      type: 'confirm',
      name: 'isConfirmed',
      message: `是否杀死 ${occupier.name} (pid=${occupier.processId}) 并重新启动服务?`,
      initial: false,
    })
    if (isConfirmed !== true) {
      this.error('已取消启动, 可用 --port 换一个端口')
    }

    await manager.killPortOccupier(occupier)
    this.log(`已杀死 ${occupier.name} (pid=${occupier.processId}), 端口 ${port} 已释放`)
  }
}
