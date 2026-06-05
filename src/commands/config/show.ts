import {Command} from '@oclif/core'
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

export default class ConfigShow extends Command {
  static description = '展示用户配置文件内容'

  static examples = ['<%= config.bin %> <%= command.id %>']

  public async run(): Promise<void> {
    // 获取配置文件路径
    const configPath = join(this.config.configDir, 'config.yml')

    // 检查配置文件是否存在
    if (!existsSync(configPath)) {
      this.error(`配置文件不存在: ${configPath}`)
    }

    try {
      // 读取配置文件内容
      const configContent = readFileSync(configPath, 'utf-8')

      // 输出配置文件路径
      this.log(`\n配置文件路径: ${configPath}\n`)

      // 输出配置内容
      this.log('配置内容:')
      this.log('─'.repeat(50))
      this.log(configContent)
      this.log('─'.repeat(50))
    } catch (error) {
      this.error(`读取配置文件失败: ${error}`)
    }
  }
}
