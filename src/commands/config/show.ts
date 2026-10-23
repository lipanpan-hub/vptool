import {existsSync, readFileSync} from 'node:fs'

import {BaseCommand} from '../../lib/base-command.js'
import {ToolConfigManager} from '../../lib/config/index.js'

// 匹配 YAML 中 TIKHUB_IO_TOKEN 的整行取值, 分隔用 [ \t] 而非 \s, 避免值为空时吞掉换行误伤下一行
const TIKHUB_TOKEN_LINE_PATTERN = /^([ \t]*(?:-[ \t]+)?TIKHUB_IO_TOKEN:[ \t]*)\S.*$/gm

export default class ConfigShow extends BaseCommand {
  static aliases = ['cf:ls', 'cf:show']
  static description = '列出所有的配置'
  static examples = ['<%= config.bin %> <%= command.id %>']

  // --json 模式下 content 为脱敏后的 YAML(TIKHUB_IO_TOKEN 的值替换为 '***'), content 为 null 表示配置文件不存在
  public async run(): Promise<{configPath: string; content: null | string}> {
    const configManager = ToolConfigManager.fromConfigDir(this.config.configDir)
    const configPath = configManager.getConfigPath()
    this.log(`配置文件路径: ${configPath}`)

    if (!existsSync(configPath)) {
      this.log('配置文件不存在')
      return {configPath, content: null}
    }

    // 直接读取原始 YAML 文本打印，保留原始格式
    const rawYaml = readFileSync(configPath, 'utf8')
    this.log(rawYaml)

    return {configPath, content: this.maskTikhubToken(rawYaml)}
  }

  // 返回值只在 --json 时被输出, 人话输出(this.log)仍打印原文
  private maskTikhubToken(rawYaml: string): string {
    return rawYaml.replaceAll(TIKHUB_TOKEN_LINE_PATTERN, "$1'***'")
  }
}
