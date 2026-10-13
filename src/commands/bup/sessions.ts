import {Flags} from '@oclif/core'

import {BaseCommand} from '../../lib/base-command.js'
import {
  BILIUP_DEFAULT_BIND,
  BILIUP_DEFAULT_PORT,
  createBiliupClient,
  formatTimestamp,
} from '../../lib/bup/biliup-client.js'

export default class BupSessions extends BaseCommand {
  static description = '分页列出 biliup 的录制场次(回看记录)'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --page 2 --page-size 50',
    '<%= config.bin %> <%= command.id %> --json',
  ]

  static flags = {
    port: Flags.integer({description: 'biliup 服务端口', default: BILIUP_DEFAULT_PORT}),
    bind: Flags.string({description: 'biliup 服务绑定地址', default: BILIUP_DEFAULT_BIND}),
    page: Flags.integer({description: '页码', default: 1}),
    'page-size': Flags.integer({description: '每页条数', default: 20}),
    json: Flags.boolean({description: '以 JSON 输出原始数据'}),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(BupSessions)
    const client = createBiliupClient(flags.port, flags.bind)

    const sessionPage = await client.listSessions(flags.page, flags['page-size'])
    if (flags.json) {
      this.log(JSON.stringify(sessionPage, null, 2))
      return
    }

    if (sessionPage.items.length === 0) {
      this.log('暂无录制场次')
      return
    }

    this.log(`共 ${sessionPage.total} 场, 第 ${sessionPage.page}/${Math.max(1, Math.ceil(sessionPage.total / sessionPage.page_size))} 页:\n`)
    for (const session of sessionPage.items) {
      this.log(`[${session.id}] ${formatTimestamp(session.started_at)} ~ ${formatTimestamp(session.ended_at)}`)
      this.log(`  直播间: ${session.url}`)
      this.log('')
    }
  }
}
