import {Command} from '@oclif/core'

import {ensureConfigFile} from '../../lib/config/ensure-config.js'
import {editConfigTui} from '../../lib/config/edit-config-tui.js'

export default class ConfigEdit extends Command {
  static description = '在终端启动 TUI 编辑器编辑用户配置文件'

  static examples = ['<%= config.bin %> <%= command.id %>']

  public async run(): Promise<void> {
    // 确保配置文件存在, 不存在则创建默认配置
    const configPath = ensureConfigFile(this.config.configDir)

    // 启动 TUI 编辑器, 等待用户编辑并退出
    await editConfigTui(configPath)
  }
}
