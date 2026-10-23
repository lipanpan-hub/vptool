import {Flags} from '@oclif/core'

import {BaseCommand} from '../../lib/base-command.js'
import {
  BILIUP_DEFAULT_BIND,
  BILIUP_DEFAULT_PORT,
  createBiliupClient,
  type BiliupPublishJobs,
} from '../../lib/bup/biliup-client.js'

export default class BupJobs extends BaseCommand {
  static description = '查看 biliup 的投稿发布队列状态'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --json',
  ]

  static flags = {
    port: Flags.integer({description: 'biliup 服务端口', default: BILIUP_DEFAULT_PORT}),
    bind: Flags.string({description: 'biliup 服务绑定地址', default: BILIUP_DEFAULT_BIND}),
  }

  public async run(): Promise<BiliupPublishJobs> {
    const {flags} = await this.parse(BupJobs)
    const client = createBiliupClient(flags.port, flags.bind)

    const publishJobs = await client.listPublishJobs()

    if (publishJobs.paused !== null) {
      this.log(`队列状态: ${publishJobs.paused ? '已暂停' : '运行中'}`)
    }
    if (publishJobs.jobs.length === 0) {
      this.log('发布队列为空')
      return publishJobs
    }

    this.log(`共 ${publishJobs.jobs.length} 个任务:\n`)
    this.log(JSON.stringify(publishJobs.jobs, null, 2))
    return publishJobs
  }
}
