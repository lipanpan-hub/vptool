import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../lib/base-command.js'
import {
  BILIUP_DEFAULT_BIND,
  BILIUP_DEFAULT_PORT,
  createBiliupClient,
  type BiliupStreamer,
} from '../../lib/bup/biliup-client.js'
import {promptRequiredText} from '../../lib/bup/interactive.js'

export default class BupAdd extends BaseCommand {
  static args = {
    url: Args.string({description: '直播间地址(支持 B 站/抖音/斗鱼/虎牙等平台, 缺省时交互式输入)', required: false}),
  }

  static description = '添加 biliup 监控主播(加入录制列表)'

  static examples = [
    '<%= config.bin %> <%= command.id %> https://live.bilibili.com/1234 --remark 某主播',
    '<%= config.bin %> <%= command.id %> https://live.bilibili.com/1234 --remark 某主播 --prefix 5535AI记忆',
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    port: Flags.integer({description: 'biliup 服务端口', default: BILIUP_DEFAULT_PORT}),
    bind: Flags.string({description: 'biliup 服务绑定地址', default: BILIUP_DEFAULT_BIND}),
    remark: Flags.string({description: '备注名称(列表中显示的名字, 缺省时交互式输入)'}),
    prefix: Flags.string({description: '录制文件名前缀'}),
  }

  public async run(): Promise<BiliupStreamer> {
    const {args, flags} = await this.parse(BupAdd)

    // #region 确定直播间地址与备注(缺省时交互式输入)
    if (args.url === undefined) {
      this.rejectInteractionInJsonMode('<url> 参数(直播间地址)')
    }
    if (flags.remark === undefined) {
      this.rejectInteractionInJsonMode('--remark <备注名称>')
    }
    const liveUrl = args.url ?? (await promptRequiredText('请输入直播间地址(支持 B 站/抖音/斗鱼/虎牙等平台):'))
    const remark = flags.remark ?? (await promptRequiredText('请输入备注名称(列表中显示的名字):'))
    // #endregion

    const client = createBiliupClient(flags.port, flags.bind)

    const streamer = await client.addStreamer({
      url: liveUrl,
      remark,
      // 字段名镜像 biliup API 的 snake_case
      'filename_prefix': flags.prefix ?? null,
    })

    this.log(`已添加监控主播: [${streamer.id}] ${streamer.remark}`)
    this.log(`直播间: ${streamer.url}`)
    return streamer
  }
}
