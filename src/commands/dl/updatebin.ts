import {Command} from '@oclif/core'

import {updateBinary} from '../../lib/dl/update-binary.js'

export default class DlUpdatebin extends Command {
  static description = '将本地 yt-dlp 二进制更新到最新版本'

  static examples = ['<%= config.bin %> <%= command.id %>']

  public async run(): Promise<void> {
    this.log('正在更新 yt-dlp 到最新版本...\n')

    const result = await updateBinary()

    this.log(`✓ 更新方式: ${result.method}`)
    this.log(`  二进制路径: ${result.binaryPath}`)
    this.log(`  更新后版本: ${result.version ?? '(未知)'}`)
  }
}
