import {Flags} from '@oclif/core'
import Table from 'cli-table3'

import {BaseCommand} from '../../lib/base-command.js'
import {AudioCppClient} from '../../lib/auc/audiocpp-client.js'
import {ToolConfigManager} from '../../lib/config/index.js'

export default class AucModels extends BaseCommand {
  static description = '列出 audiocpp_server 已注册的模型及加载状态'

  static examples = ['<%= config.bin %> <%= command.id %>']

  static flags = {
    port: Flags.integer({description: '服务监听端口(需与启动时一致)', default: 8080}),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(AucModels)

    const audioCppDir = ToolConfigManager.fromConfigDir(this.config.configDir).getAudioCppDir()
    if (audioCppDir === null) {
      this.error('未配置 audiocpp 目录, 请先执行: vp auc cfset <audiocpp目录>')
    }

    const client = new AudioCppClient({baseUrl: `http://127.0.0.1:${flags.port}`})
    const models = await client.listModels()

    if (models.length === 0) {
      this.log('当前没有已注册的模型, 请先执行: vp auc load <模型目录>')
      return
    }

    const table = new Table({head: ['id', 'family', 'task', 'loaded', 'path']})
    for (const model of models) {
      table.push([model.id, model.family, model.task, model.loaded ? '✓' : '✗', model.path])
    }
    this.log(table.toString())
  }
}
