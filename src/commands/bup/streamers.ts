import {Flags} from '@oclif/core'

import {BaseCommand} from '../../lib/base-command.js'
import {
  BILIUP_DEFAULT_BIND,
  BILIUP_DEFAULT_PORT,
  createBiliupClient,
  formatStreamerStatus,
} from '../../lib/bup/biliup-client.js'

export default class BupStreamers extends BaseCommand {
  static description = '列出 biliup 监控的全部主播及其录制/上传状态'

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
    const {flags} = await this.parse(BupStreamers)
    const client = createBiliupClient(flags.port, flags.bind)

    const streamers = await client.listStreamers()
    if (flags.json) {
      this.log(JSON.stringify(streamers, null, 2))
      return
    }

    if (streamers.length === 0) {
      this.log('暂无监控主播, 可执行: vp bup add <直播间地址> --remark <备注名>')
      return
    }

    this.log(`共 ${streamers.length} 个监控主播:\n`)
    for (const streamer of streamers) {
      this.log(`[${streamer.id}] ${streamer.remark}`)
      this.log(`  地址: ${streamer.url}`)
      this.log(`  状态: ${formatStreamerStatus(streamer)}`)
      if (streamer.filename_prefix !== null) {
        this.log(`  文件名前缀: ${streamer.filename_prefix}`)
      }
      if (streamer.time_range !== null) {
        this.log(`  录制时间段: ${streamer.time_range}`)
      }
      this.log('')
    }
  }
}
