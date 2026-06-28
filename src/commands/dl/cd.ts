import {Args, Command} from '@oclif/core'
import {existsSync} from 'node:fs'

import {readDocumentsDir} from '../../lib/config/read-config.js'
import {listFiles} from '../../lib/dl/list-files.js'
import {selectDirectory} from '../../lib/dl/select-directory.js'
import {spawnShellAt} from '../../lib/dl/spawn-shell.js'

export default class DlCd extends Command {
  static args = {
    x: Args.string({description: '要进入的目录路径（支持模糊匹配）', required: false}),
  }

  static description = '在 documentsPath 下交互式选择并进入一个目录'

  static examples = ['<%= config.bin %> <%= command.id %>', '<%= config.bin %> <%= command.id %> mydir']

  public async run(): Promise<void> {
    const {args} = await this.parse(DlCd)
    const documentsPath = readDocumentsDir(this.config.configDir)

    if (!documentsPath) {
      this.error('配置文件中未找到 documentsPath 字段')
    }

    if (!existsSync(documentsPath)) {
      this.error(`目录不存在: ${documentsPath}`)
    }

    // 收集所有子目录（含根目录本身）
    const dirs = [
      {depth: -1, fullPath: documentsPath, name: '（根目录）'},
      ...listFiles(documentsPath)
        .filter((e) => e.isDir)
        .map((e) => ({depth: e.depth, fullPath: e.fullPath, name: e.name})),
    ]

    const target = await selectDirectory(dirs, args.x)

    this.log(`进入目录: ${target} (输入 exit 退出并返回)`)
    await spawnShellAt(target)
  }
}
