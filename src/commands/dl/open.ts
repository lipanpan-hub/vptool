import {Command} from '@oclif/core'
import {existsSync} from 'node:fs'

import {readDocumentsDir} from '../../lib/config/read-config.js'
import {openPath} from '../../lib/dl/open-path.js'

export default class DlOpen extends Command {
  static description = '打开配置文件中 documentsPath 指定的目录'

  static examples = ['<%= config.bin %> <%= command.id %>']

  public async run(): Promise<void> {
    const documentsPath = readDocumentsDir(this.config.configDir)

    if (!documentsPath) {
      this.error('配置文件中未找到 documentsPath 字段')
    }

    if (!existsSync(documentsPath)) {
      this.error(`目录不存在: ${documentsPath}`)
    }

    openPath(documentsPath)
    this.log(`已打开目录: ${documentsPath}`)
  }
}
