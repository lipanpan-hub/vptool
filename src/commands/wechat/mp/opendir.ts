// 这个命令的作用是 找到配置文件中 documentsPath 然后调用系统文件管理器 打开下面的 1111微信公众号文件夹

import {Command} from '@oclif/core'
import {existsSync} from 'node:fs'
import {join} from 'node:path'

import {ToolConfigManager} from '../../../lib/config/index.js'
import {openPath} from '../../../lib/dl/open-path.js'
import {ROOT_FOLDER} from '../../../lib/wechat/mp/save-article.js'

export default class WechatMpOpendir extends Command {
  static aliases = ['wx:mp:opendir','mp:opendir','mp:open']
  static description = `打开配置文件中 documentsPath 下的 ${ROOT_FOLDER} 目录`
  static examples = ['<%= config.bin %> <%= command.id %>']

  public async run(): Promise<void> {
    const documentsPath = ToolConfigManager.fromConfigDir(this.config.configDir).getDocumentsPath()
    const targetPath = join(documentsPath, ROOT_FOLDER)

    if (!existsSync(targetPath)) {
      this.error(`目录不存在: ${targetPath}`)
    }

    openPath(targetPath)
    this.log(`已打开目录: ${targetPath}`)
  }
}
