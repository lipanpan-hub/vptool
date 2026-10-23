import {Args} from '@oclif/core'
import {existsSync} from 'node:fs'

import {BaseCommand} from '../../lib/base-command.js'
import {type FfprobeResult, probeMedia} from '../../lib/fft/probe.js'
import {selectFile} from '../../lib/vtt/select-file.js'

// 常见音视频扩展名, 交互选择时据此过滤当前目录文件
const MEDIA_EXTENSIONS = [
  '.mp4', '.mkv', '.mov', '.avi', '.flv', '.webm', '.ts', '.m4v',
  '.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.wma',
]

export default class FftProbe extends BaseCommand {
  static aliases = ['fft:pb']

  static args = {
    media: Args.string({description: '音视频文件路径(省略则扫描当前目录交互选择)'}),
  }

  static description = '调用 ffprobe 查看音视频文件的详细信息, 以人类可读方式输出'

  static examples = [
    '<%= config.bin %> <%= command.id %> input.mp4',
    '<%= config.bin %> <%= command.id %>',
  ]

  // --json 模式下 data 即 ffprobe 原始解析结果 {format, streams}
  public async run(): Promise<FfprobeResult> {
    const {args} = await this.parse(FftProbe)

    if (!args.media) this.rejectInteractionInJsonMode('<media> 参数')
    const mediaPath = args.media ?? (await selectFile(MEDIA_EXTENSIONS, '请选择要查看的音视频文件:'))

    if (!existsSync(mediaPath)) this.error(`文件不存在: ${mediaPath}`)

    return probeMedia(mediaPath, this)
  }
}
