import {Flags} from '@oclif/core'

import {BaseCommand} from '../../lib/base-command.js'
import {BILIUP_DEFAULT_BIND, BILIUP_DEFAULT_PORT, createBiliupClient, type BiliupMe, type BiliupStatus} from '../../lib/bup/biliup-client.js'

export default class BupStatus extends BaseCommand {
  static description = '查看 biliup 服务概览: 版本、认证状态、房间数与关键录制配置'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --json',
    '<%= config.bin %> <%= command.id %> --port 19160',
  ]

  static flags = {
    port: Flags.integer({description: 'biliup 服务端口', default: BILIUP_DEFAULT_PORT}),
    bind: Flags.string({description: 'biliup 服务绑定地址', default: BILIUP_DEFAULT_BIND}),
  }

  public async run(): Promise<{me: BiliupMe; status: BiliupStatus}> {
    const {flags} = await this.parse(BupStatus)
    const client = createBiliupClient(flags.port, flags.bind)

    // #region 拉取数据
    const [status, me] = await Promise.all([client.getStatus(), client.getMe()])
    // #endregion

    // #region 人话摘要输出
    const config = status.config
    this.log(`服务版本: ${status.version}`)
    this.log(`服务地址: http://${flags.bind}:${flags.port}`)
    this.log(`Fleet 控制面: ${me.fleet_controller ? '是' : '否'}`)
    this.log(`登录认证: ${me.auth_enabled ? `已开启 (角色 ${me.role})` : '未开启'}`)
    this.log(`录制中房间: ${status.rooms.length}`)
    this.log(`下载/上传并发: ${status.download_semaphore}/${status.update_semaphore}`)
    this.log(`单文件大小上限: ${Number(config.file_size) / (1024 * 1024 * 1024)} GiB`)
    this.log(`上传线路: ${String(config.lines)}`)
    this.log(`录制检查间隔: ${String(config.checker_sleep)} 秒`)
    this.log(`工作线程: ${String(config.threads)}`)
    // #endregion

    return {status, me}
  }
}
