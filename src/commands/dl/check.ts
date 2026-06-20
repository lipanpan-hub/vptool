import {Command, Flags} from '@oclif/core'

import {checkEnvironment} from '../../lib/dl/check-environment.js'
import {downloadBinaries} from '../../lib/dl/download-binaries.js'

export default class DlCheck extends Command {
  static description = '检查基础环境是否就绪（打印 yt-dlp 与 ffmpeg 的路径和版本）'

  static examples = ['<%= config.bin %> <%= command.id %>', '<%= config.bin %> <%= command.id %> --update']

  static flags = {
    update: Flags.boolean({char: 'u', description: '下载并更新所需的二进制 (yt-dlp 与 ffmpeg)'}),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(DlCheck)

    if (flags.update) {
      this.log('开始下载/更新二进制...\n')
      await downloadBinaries((msg) => this.log(msg))
      this.log('')
    }

    this.log('正在检查基础环境...\n')

    const {ffmpeg, ready, ytdlp} = checkEnvironment()

    // 打印 yt-dlp 信息
    if (ytdlp.found) {
      this.log(`✓ yt-dlp 已就绪`)
      this.log(`  路径: ${ytdlp.path}`)
      this.log(`  版本: ${ytdlp.version}\n`)
    } else {
      this.log('✗ 未找到 yt-dlp 二进制\n')
    }

    // 打印 ffmpeg 信息
    if (ffmpeg.found) {
      this.log(`✓ ffmpeg 已就绪`)
      this.log(`  路径: ${ffmpeg.path}`)
      this.log(`  版本: ${ffmpeg.version}\n`)
    } else {
      this.log('✗ 未找到 ffmpeg 二进制\n')
    }

    if (ready) {
      this.log('✅ 基础环境已就绪')
    } else {
      this.log('⚠️  依赖未就绪，请先下载缺失的二进制')
    }
  }
}
