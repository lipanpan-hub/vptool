import {Flags} from '@oclif/core'
import {existsSync} from 'node:fs'

import {BaseCommand} from '../../lib/base-command.js'
import {ToolConfigManager} from '../../lib/config/index.js'
import {type FileEntry, formatSize, listFiles} from '../../lib/dl/list-files.js'

export default class DlList extends BaseCommand {
  static description = '递归列出配置文件中 documentsPath 指定目录下的所有文件和文件夹'

  static examples = ['<%= config.bin %> <%= command.id %>', '<%= config.bin %> <%= command.id %> --path']

  static flags = {
    path: Flags.boolean({char: 'p', description: '显示文件和文件夹的完整路径'}),
  }

  public async run(): Promise<{documentsPath: string; entries: FileEntry[]}> {
    const {flags} = await this.parse(DlList)
    const documentsPath = ToolConfigManager.fromConfigDir(this.config.configDir).getDocumentsPath()

    if (!existsSync(documentsPath)) {
      this.error(`目录不存在: ${documentsPath}`)
    }

    const entries = listFiles(documentsPath)

    if (entries.length === 0) {
      this.log('目录为空')
      return {documentsPath, entries}
    }

    this.log(`目录: ${documentsPath}\n`)
    for (const entry of entries) {
      const label = flags.path ? entry.fullPath : '  '.repeat(entry.depth) + entry.name
      if (entry.isDir) {
        this.log(`${label}/`)
      } else {
        this.log(`${label}  (${formatSize(entry.size)})`)
      }
    }

    return {documentsPath, entries}
  }
}
