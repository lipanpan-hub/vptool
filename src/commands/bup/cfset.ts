import {Args} from '@oclif/core'
import {existsSync, statSync} from 'node:fs'
import {resolve} from 'node:path'

import {BaseCommand} from '../../lib/base-command.js'
import {ToolConfigManager} from '../../lib/config/index.js'
import {promptRequiredText} from '../../lib/bup/interactive.js'

export default class BupCfset extends BaseCommand {
  static args = {
    dir: Args.string({description: 'biliupR 的目录路径(缺省时交互式输入)', required: false}),
  }

  static description = '设置 biliupR 的目录路径到配置文件(写入当前配置档案的 biliupRDir 字段)'

  static examples = [
    '<%= config.bin %> <%= command.id %> E:/tools/biliupR',
    '<%= config.bin %> <%= command.id %>',
  ]

  public async run(): Promise<void> {
    const {args} = await this.parse(BupCfset)

    // 统一转绝对路径, 避免相对路径在不同工作目录下语义漂移
    const biliupRDir = resolve(args.dir ?? (await promptRequiredText('请输入 biliupR 的目录路径:')))

    if (!existsSync(biliupRDir)) {
      this.error(`目录不存在: ${biliupRDir}`)
    }
    if (!statSync(biliupRDir).isDirectory()) {
      this.error(`路径不是目录: ${biliupRDir}`)
    }

    const configManager = ToolConfigManager.fromConfigDir(this.config.configDir)
    configManager.setBiliupRDir(biliupRDir)
    this.log(`已将 biliupR 目录写入配置: ${biliupRDir}`)
    this.log(`配置文件: ${configManager.getConfigPath()}`)
  }
}
