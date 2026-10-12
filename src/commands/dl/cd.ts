import {Args, Command} from '@oclif/core'
import {existsSync} from 'node:fs'

import {ToolConfigManager} from '../../lib/config/index.js'
import {browseDirectory} from '../../lib/dl/browse-directory.js'
import {DirectoryIndex} from '../../lib/dl/directory-index.js'
import {spawnShellAt} from '../../lib/dl/spawn-shell.js'

export default class DlCd extends Command {
  static args = {
    dir: Args.string({description: '要进入的目录名称（支持中文/拼音/首字母模糊匹配，唯一匹配时直接进入）', required: false}),
  }

  static description = '在 documentsPath 下用双栏浏览器选择目录并进入（左栏兄弟目录、右栏子目录，输入可全树搜索）'

  static examples = ['<%= config.bin %> <%= command.id %>', '<%= config.bin %> <%= command.id %> mydir']

  public async run(): Promise<void> {
    const {args} = await this.parse(DlCd)
    const documentsPath = ToolConfigManager.fromConfigDir(this.config.configDir).getDocumentsPath()

    if (!existsSync(documentsPath)) {
      this.error(`目录不存在: ${documentsPath}`)
    }

    // #region 定位目标目录: 参数唯一匹配直达, 否则进入双栏浏览器
    const index = new DirectoryIndex(documentsPath)
    const uniqueMatch = args.dir ? index.findUniqueMatch(args.dir) : undefined
    const target = uniqueMatch ? uniqueMatch.fullPath : await browseDirectory(index, args.dir)
    // #endregion

    if (!target) {
      this.log('已取消')
      return
    }

    this.log(`进入目录: ${target} (输入 exit 退出并返回)`)
    await spawnShellAt(target)
  }
}
