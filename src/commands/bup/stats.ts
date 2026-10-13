import {Flags} from '@oclif/core'

import {BaseCommand} from '../../lib/base-command.js'
import {
  BILIUP_DEFAULT_BIND,
  BILIUP_DEFAULT_PORT,
  createBiliupClient,
} from '../../lib/bup/biliup-client.js'
import {formatSize} from '../../lib/dl/list-files.js'

export default class BupStats extends BaseCommand {
  static description = '查看 biliup 服务所在主机的资源快照: CPU/内存/磁盘/网速'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --json',
  ]

  static flags = {
    port: Flags.integer({description: 'biliup 服务端口', default: BILIUP_DEFAULT_PORT}),
    bind: Flags.string({description: 'biliup 服务绑定地址', default: BILIUP_DEFAULT_BIND}),
    json: Flags.boolean({description: '以 JSON 输出原始数据'}),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(BupStats)
    const client = createBiliupClient(flags.port, flags.bind)

    const stats = await client.getSystemStats()
    if (flags.json) {
      this.log(JSON.stringify(stats, null, 2))
      return
    }

    // #region 人话摘要输出
    const memoryUsedPercent = ((stats.memory.used / stats.memory.total) * 100).toFixed(1)
    const diskUsedPercent = ((stats.disk.used / stats.disk.total) * 100).toFixed(1)
    // 最新一个采样点即当前网速(单位: 字节/秒)
    const latestSample = stats.samples.at(-1)

    this.log(`CPU 核心: ${stats.cpu.physical} 物理 / ${stats.cpu.logical} 逻辑`)
    this.log(`内存: ${formatSize(stats.memory.used)} / ${formatSize(stats.memory.total)} (${memoryUsedPercent}%)`)
    this.log(`磁盘 (${stats.disk.path}): ${formatSize(stats.disk.used)} / ${formatSize(stats.disk.total)} (${diskUsedPercent}%)`)
    if (latestSample !== undefined) {
      this.log(`网速: 下行 ${formatSize(latestSample.rx)}/s | 上行 ${formatSize(latestSample.tx)}/s`)
    }
    this.log(`网卡: ${stats.interfaces.join(', ')}`)
    // #endregion
  }
}
