import {existsSync} from 'node:fs'

import {BaseCommand} from '../../lib/base-command.js'
import {ToolConfigManager} from '../../lib/config/index.js'
import {openPath} from '../../lib/dl/open-path.js'

export default class DlOpen extends BaseCommand {
  static description = '打开配置文件中 documentsPath 指定的目录'

  static examples = ['<%= config.bin %> <%= command.id %>']

  public async run(): Promise<{openedPath: string}> {
    const documentsPath = ToolConfigManager.fromConfigDir(this.config.configDir).getDocumentsPath()

    if (!existsSync(documentsPath)) {
      this.error(`目录不存在: ${documentsPath}`)
    }

    openPath(documentsPath)
    this.log(`已打开目录: ${documentsPath}`)
    return {openedPath: documentsPath}
  }
}
