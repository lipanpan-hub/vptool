// 这个命令的作用是对视频进行无损快速切割
// 扫描当前目录让用户交互式选择需要被操作的视频
// 交互式询问开始时间和结束时间, 用户选定时间之后开始执行分割操作

import {Args, Command} from '@oclif/core'
import {existsSync} from 'node:fs'
import prompts from 'prompts'

import {parseTimeToSeconds, videoSplitCopy} from '../../lib/fft/video-split-copy.js'
import {selectFile} from '../../lib/vtt/select-file.js'

export default class FftVideoSplitCopy extends Command {
  static aliases = ['fft:vsc']
  static args = {
    video: Args.string({description: '源 mp4 文件(省略则扫描当前目录交互选择)'}),
  }
  static description = '对 mp4 进行无损快速切割(不重编码), 按指定起止时间输出片段'
  static examples = [
    '<%= config.bin %> <%= command.id %> input.mp4',
    '<%= config.bin %> <%= command.id %>',
  ]

  public async run(): Promise<void> {
    const {args} = await this.parse(FftVideoSplitCopy)

    // #region 选择源视频
    const videoPath = args.video ?? (await selectFile(['.mp4','.webm'], '请选择要切割的文件:'))
    if (!existsSync(videoPath)) this.error(`文件不存在: ${videoPath}`)
    // #endregion

    // #region 交互式询问开始/结束时间
    const {start} = await prompts({
      message: '开始时间(如 00:00:10 或 10):',
      name: 'start',
      type: 'text',
      validate: (value) => (isValidTime(value) ? true : '时间格式无效, 请用秒数或 HH:MM:SS'),
    })
    if (!start) {
      this.log('已取消')
      return
    }

    const startSec = parseTimeToSeconds(start)
    const {end} = await prompts({
      message: '结束时间(如 00:00:30 或 30):',
      name: 'end',
      type: 'text',
      validate(value) {
        if (!isValidTime(value)) return '时间格式无效, 请用秒数或 HH:MM:SS'
        return parseTimeToSeconds(value) > startSec ? true : '结束时间必须晚于开始时间'
      },
    })
    if (!end) {
      this.log('已取消')
      return
    }
    // #endregion

    // #region 执行切割
    this.log(`正在切割 ${videoPath} (${start} → ${end})...`)
    await videoSplitCopy(videoPath, start, end, this)
    // #endregion
  }
}

function isValidTime(value: string): boolean {
  // 借助解析函数判断格式合法性, 解析抛错即视为非法
  try {
    parseTimeToSeconds(value)
    return true
  } catch {
    return false
  }
}
