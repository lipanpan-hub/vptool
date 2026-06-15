import {Command, Flags} from '@oclif/core'
import {existsSync} from 'node:fs'

import {readDocumentsDir} from '../../lib/config/read-config.js'
import {formatSize, listFiles} from '../../lib/dl/list-files.js'

export default class DlList extends Command {
  static description = '递归列出配置文件中 documentsPath 指定目录下的所有文件和文件夹'

  static examples = ['<%= config.bin %> <%= command.id %>', '<%= config.bin %> <%= command.id %> --path']

  static flags = {
    path: Flags.boolean({char: 'p', description: '显示文件和文件夹的完整路径'}),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(DlList)
    const documentsPath = readDocumentsDir(this.config.configDir)

    if (!documentsPath) {
      this.error('配置文件中未找到 documentsPath 字段')
    }

    if (!existsSync(documentsPath)) {
      this.error(`目录不存在: ${documentsPath}`)
    }

    const entries = listFiles(documentsPath)

    if (entries.length === 0) {
      this.log('目录为空')
      return
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
  }
}
