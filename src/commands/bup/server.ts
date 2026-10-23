import {Flags} from '@oclif/core'
import {resolve} from 'node:path'

import {BaseCommand} from '../../lib/base-command.js'
import {BiliupServerManager} from '../../lib/bup/biliup-server-manager.js'
import {ToolConfigManager} from '../../lib/config/index.js'

export default class BupServer extends BaseCommand {
  static aliases = ['bup:server','bup:run']
  static description = '后台启动 biliup web 服务并等待就绪(服务目录取配置档案的 biliupRDir 字段)'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --port 19160',
  ]

  static flags = {
    port: Flags.integer({description: '服务监听端口', default: 19_159}),
    bind: Flags.string({description: '服务绑定地址', default: '127.0.0.1'}),
  }

  public async run(): Promise<{baseUrl: string; biliupRDir: string; isAlreadyRunning: boolean; logFilePath: string}> {
    const {flags} = await this.parse(BupServer)

    const biliupRDir = ToolConfigManager.fromConfigDir(this.config.configDir).getBiliupRDir()
    if (biliupRDir === null) {
      this.error('未配置 biliupR 目录, 请先执行: vp bup cfset <biliupR目录>')
    }

    // 统一转绝对路径, 避免相对路径在不同工作目录下语义漂移
    const manager = new BiliupServerManager({biliupRDir: resolve(biliupRDir), port: flags.port, bind: flags.bind})

    // #region 前置检查
    try {
      manager.checkPrerequisites()
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error))
    }
    // #endregion

    // #region 启动并输出结果
    const startResult = await manager.start()
    const serverInfo = {
      baseUrl: manager.baseUrl,
      biliupRDir,
      isAlreadyRunning: startResult.kind === 'already-running',
      logFilePath: manager.logFilePath,
    }
    if (serverInfo.isAlreadyRunning) {
      this.log(`服务已在运行, 复用现有进程: ${manager.baseUrl}`)
      return serverInfo
    }

    this.log(`服务就绪: ${manager.baseUrl}`)
    this.log(`工作目录: ${biliupRDir}`)
    this.log(`日志文件: ${manager.logFilePath}`)
    return serverInfo
    // #endregion
  }
}
