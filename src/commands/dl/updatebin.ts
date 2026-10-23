import {BaseCommand} from '../../lib/base-command.js'
import {withStdoutToStderr} from '../../lib/dl/redirect-stdout.js'
import {updateBinary, type UpdateResult} from '../../lib/dl/update-binary.js'

export default class DlUpdatebin extends BaseCommand {
  static description = '将本地 yt-dlp 二进制更新到最新版本'

  static examples = ['<%= config.bin %> <%= command.id %>']

  public async run(): Promise<UpdateResult> {
    this.log('正在更新 yt-dlp 到最新版本...\n')

    // 回退到下载二进制时 ytdlp-nodejs 会直接写 stdout, JSON 模式下转到 stderr
    const result = await withStdoutToStderr(this.jsonEnabled(), () => updateBinary())

    this.log(`✓ 更新方式: ${result.method}`)
    this.log(`  二进制路径: ${result.binaryPath}`)
    this.log(`  更新后版本: ${result.version ?? '(未知)'}`)

    return result
  }
}
