import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../lib/base-command.js'
import {
  BILIUP_DEFAULT_BIND,
  BILIUP_DEFAULT_PORT,
  createBiliupClient,
} from '../../lib/bup/biliup-client.js'
import {requireStreamerById, selectStreamer} from '../../lib/bup/interactive.js'

export default class BupPause extends BaseCommand {
  static args = {
    id: Args.integer({description: '主播 id(缺省时交互式选择)', required: false}),
  }

  static description = '暂停 biliup 对指定主播的录制(再次执行 vp bup resume 或本命令切换恢复)'

  static examples = [
    '<%= config.bin %> <%= command.id %> 3',
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    port: Flags.integer({description: 'biliup 服务端口', default: BILIUP_DEFAULT_PORT}),
    bind: Flags.string({description: 'biliup 服务绑定地址', default: BILIUP_DEFAULT_BIND}),
  }

  public async run(): Promise<{id: number; remark: string}> {
    const {args, flags} = await this.parse(BupPause)
    const client = createBiliupClient(flags.port, flags.bind)

    if (args.id === undefined) {
      this.rejectInteractionInJsonMode('<id> 参数(主播 id)')
    }

    // 未传 id 时交互式选择, 传了则校验存在性; 服务端 pause 为 toggle 语义
    const target = (args.id === undefined)
      ? await selectStreamer(client, '请选择要暂停录制的主播(选中即切换状态):')
      : await requireStreamerById(client, args.id)

    await client.togglePause(target.id)
    this.log(`已切换主播 [${target.id}] ${target.remark} 的录制状态, 可执行 vp bup streamers 确认`)
    return {id: target.id, remark: target.remark}
  }
}
