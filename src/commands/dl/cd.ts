import {Command} from '@oclif/core'
import {existsSync} from 'node:fs'

import {readDocumentsDir} from '../../lib/config/read-config.js'
import {spawnShellAt} from '../../lib/dl/spawn-shell.js'

export default class DlCd extends Command {
  static description = '在配置文件中 documentsPath 指定的目录下启动一个新 shell,退出后回到原处'

  static examples = ['<%= config.bin %> <%= command.id %>']

  public async run(): Promise<void> {
    const documentsPath = readDocumentsDir(this.config.configDir)

    if (!documentsPath) {
      this.error('配置文件中未找到 documentsPath 字段')
    }

    if (!existsSync(documentsPath)) {
      this.error(`目录不存在: ${documentsPath}`)
    }

    this.log(`进入目录: ${documentsPath} (输入 exit 退出并返回)`)
    await spawnShellAt(documentsPath)
  }
}
