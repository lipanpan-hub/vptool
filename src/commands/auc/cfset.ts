import {Args} from '@oclif/core'
import {existsSync, statSync} from 'node:fs'
import {resolve} from 'node:path'

import {BaseCommand} from '../../lib/base-command.js'
import {ToolConfigManager} from '../../lib/config/index.js'

export default class AucCfset extends BaseCommand {
  static args = {
    dir: Args.string({description: 'audiocpp 包的目录路径', required: true}),
  }

  static description = '设置 audiocpp 包的目录路径到配置文件(写入当前配置档案的 audioCppDir 字段)'

  static examples = ['<%= config.bin %> <%= command.id %> E:/tools/audiocpp']

  public async run(): Promise<void> {
    const {args} = await this.parse(AucCfset)
    // 统一转绝对路径, 避免相对路径在不同工作目录下语义漂移
    const audioCppDir = resolve(args.dir)

    if (!existsSync(audioCppDir)) {
      this.error(`目录不存在: ${audioCppDir}`)
    }
    if (!statSync(audioCppDir).isDirectory()) {
      this.error(`路径不是目录: ${audioCppDir}`)
    }

    const configManager = ToolConfigManager.fromConfigDir(this.config.configDir)
    configManager.setAudioCppDir(audioCppDir)
    this.log(`已将 audiocpp 目录写入配置: ${audioCppDir}`)
    this.log(`配置文件: ${configManager.getConfigPath()}`)
  }
}
