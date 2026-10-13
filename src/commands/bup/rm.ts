import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../lib/base-command.js'
import {
  BILIUP_DEFAULT_BIND,
  BILIUP_DEFAULT_PORT,
  createBiliupClient,
} from '../../lib/bup/biliup-client.js'
import {requireStreamerById, selectStreamer} from '../../lib/bup/interactive.js'

export default class BupRm extends BaseCommand {
  static args = {
    id: Args.integer({description: '主播 id(缺省时交互式选择)', required: false}),
  }

  static description = '从 biliup 删除监控主播(不影响已录制文件)'

  static examples = [
    '<%= config.bin %> <%= command.id %> 3',
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    port: Flags.integer({description: 'biliup 服务端口', default: BILIUP_DEFAULT_PORT}),
    bind: Flags.string({description: 'biliup 服务绑定地址', default: BILIUP_DEFAULT_BIND}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(BupRm)
    const client = createBiliupClient(flags.port, flags.bind)

    // 未传 id 时交互式选择, 传了则校验存在性
    const target = (args.id === undefined)
      ? await selectStreamer(client, '请选择要删除的监控主播:')
      : await requireStreamerById(client, args.id)

    await client.deleteStreamer(target.id)
    this.log(`已删除监控主播: [${target.id}] ${target.remark}`)
  }
}
