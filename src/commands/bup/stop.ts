import {Flags} from '@oclif/core'
import {resolve} from 'node:path'

import {BaseCommand} from '../../lib/base-command.js'
import {BiliupServerManager, SERVER_DEFAULT_BIND, SERVER_DEFAULT_PORT} from '../../lib/bup/biliup-server-manager.js'
import {ToolConfigManager} from '../../lib/config/index.js'

export default class BupStop extends BaseCommand {
  static aliases = ['bup:stop']
  static description = '停止 biliup web 服务(按监听端口定位进程并终止, 服务目录取配置档案的 biliupRDir 字段)'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --port 19160',
  ]

  static flags = {
    port: Flags.integer({description: '服务监听端口(需与启动时一致)', default: SERVER_DEFAULT_PORT}),
  }

  public async run(): Promise<{isStopped: boolean; port: number; processId?: number; processName?: string}> {
    const {flags} = await this.parse(BupStop)

    // 停止逻辑依赖 Windows 的 Get-NetTCPConnection 定位进程, 其他平台直接提示
    if (process.platform !== 'win32') {
      this.error('vp bup stop 仅支持 Windows 平台')
    }

    const biliupRDir = ToolConfigManager.fromConfigDir(this.config.configDir).getBiliupRDir()
    if (biliupRDir === null) {
      this.error('未配置 biliupR 目录, 请先执行: vp bup cfset <biliupR目录>')
    }

    // 统一转绝对路径, 与 server 命令保持一致
    const manager = new BiliupServerManager({biliupRDir: resolve(biliupRDir), port: flags.port, bind: SERVER_DEFAULT_BIND})

    // #region 停止并输出结果
    const stopResult = await manager.stop()
    if (stopResult.kind === 'not-running') {
      this.log(`服务未在运行: 端口 ${flags.port} 无 biliup 监听`)
      return {isStopped: false, port: flags.port}
    }

    this.log(`服务已关闭: ${stopResult.processName} (pid=${stopResult.processId}, port=${flags.port})`)
    return {isStopped: true, port: flags.port, processId: stopResult.processId, processName: stopResult.processName}
    // #endregion
  }
}
