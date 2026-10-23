import {Flags} from '@oclif/core'

import {BaseCommand} from '../../lib/base-command.js'
import {
  BILIUP_DEFAULT_BIND,
  BILIUP_DEFAULT_PORT,
  createBiliupClient,
  pickText,
  type BiliupVideo,
} from '../../lib/bup/biliup-client.js'
import {formatSize} from '../../lib/dl/list-files.js'

export default class BupVideos extends BaseCommand {
  static description = '列出 biliup 录制产出的视频文件'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --json',
  ]

  static flags = {
    port: Flags.integer({description: 'biliup 服务端口', default: BILIUP_DEFAULT_PORT}),
    bind: Flags.string({description: 'biliup 服务绑定地址', default: BILIUP_DEFAULT_BIND}),
  }

  public async run(): Promise<BiliupVideo[]> {
    const {flags} = await this.parse(BupVideos)
    const client = createBiliupClient(flags.port, flags.bind)

    const videos = await client.listVideos()

    if (videos.length === 0) {
      this.log('暂无录制产出文件')
      return videos
    }

    this.log(`共 ${videos.length} 个文件:\n`)
    for (const video of videos) {
      this.log(`[${video.id}] ${describeVideo(video)}`)
    }

    return videos
  }
}

/**
 * 服务端文件字段未定型, 按候选字段名兜底取路径与大小。
 */
function describeVideo(video: BiliupVideo): string {
  const record = video as Record<string, unknown>
  const pathText = pickText(record, ['path', 'file_path', 'filename', 'name'])
  const sizeValue = record.size ?? record.file_size ?? record.bytes
  const sizeText = (typeof sizeValue === 'number') ? ` (${formatSize(sizeValue)})` : ''
  return `${pathText}${sizeText}`
}
