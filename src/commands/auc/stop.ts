import {Flags} from '@oclif/core'

import {BaseCommand} from '../../lib/base-command.js'
import {AudioCppServerManager} from '../../lib/auc/audiocpp-server-manager.js'
import {ToolConfigManager} from '../../lib/config/index.js'

export default class AucStop extends BaseCommand {
  static description = '停止 audiocpp_server 服务(按监听端口定位进程并终止, 服务目录取配置档案的 audioCppDir 字段)'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --port 8081',
  ]

  static flags = {
    port: Flags.integer({description: '服务监听端口(需与启动时一致)', default: 8080}),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(AucStop)

    // 停止逻辑依赖 Windows 的 Get-NetTCPConnection 定位进程, 其他平台直接提示
    if (process.platform !== 'win32') {
      this.error('vp auc stop 仅支持 Windows 平台')
    }

    const audioCppDir = ToolConfigManager.fromConfigDir(this.config.configDir).getAudioCppDir()
    if (audioCppDir === null) {
      this.error('未配置 audiocpp 目录, 请先执行: vp auc cfset <audiocpp目录>')
    }

    const manager = new AudioCppServerManager({audioCppDir, port: flags.port})
    const stopResult = await manager.stop()

    if (stopResult.kind === 'not-running') {
      this.log(`服务未在运行: ${manager.baseUrl}`)
      return
    }

    this.log(`服务已关闭: ${stopResult.processName} (pid=${stopResult.processId}, port=${flags.port})`)
  }
}
