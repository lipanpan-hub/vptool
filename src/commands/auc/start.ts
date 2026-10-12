import {Flags} from '@oclif/core'
import {resolve} from 'node:path'

import {BaseCommand} from '../../lib/base-command.js'
import {AudioCppServerManager} from '../../lib/auc/audiocpp-server-manager.js'
import {ToolConfigManager} from '../../lib/config/index.js'

export default class AucStart extends BaseCommand {
  static alias = ['auc:start','auc:run']
  static description = '后台启动 audiocpp_server 服务并等待就绪(服务目录取配置档案的 audioCppDir 字段)'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --port 8081 --backend cpu',
  ]

  static flags = {
    port: Flags.integer({description: '服务监听端口', default: 8080}),
    backend: Flags.string({description: '计算后端', default: 'cuda'}),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(AucStart)

    const audioCppDir = ToolConfigManager.fromConfigDir(this.config.configDir).getAudioCppDir()
    if (audioCppDir === null) {
      this.error('未配置 audiocpp 目录, 请先执行: vp auc cfset <audiocpp目录>')
    }

    // 统一转绝对路径, 避免相对路径在不同工作目录下语义漂移
    const manager = new AudioCppServerManager({audioCppDir: resolve(audioCppDir), port: flags.port, backend: flags.backend})

    // #region 前置检查
    try {
      manager.checkPrerequisites()
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error))
    }
    // #endregion

    // #region 启动并输出结果
    const startResult = await manager.start()
    if (startResult.kind === 'already-running') {
      this.log(`服务已在运行, 复用现有进程: ${manager.baseUrl}`)
      return
    }

    this.log(`服务就绪: backend=${startResult.health.backend}`)
    this.log(`服务地址: ${manager.baseUrl}`)
    this.log(`日志文件: ${manager.logFilePath}`)
    // #endregion
  }
}
