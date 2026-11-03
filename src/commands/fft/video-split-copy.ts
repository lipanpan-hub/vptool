// 这个命令的作用是对视频进行无损快速切割
// 未提供区间时交互式逐段录入起止时间, 每段立即切割并询问是否继续
// 提供 --start/--end 时直接切单段, 便于命令行与 --json 调用

import {Args, Flags} from '@oclif/core'
import {existsSync} from 'node:fs'

import {BaseCommand} from '../../lib/base-command.js'
import {validateSegmentRange, VideoSegmentSplitter} from '../../lib/fft/video-split-copy.js'
import {selectFile} from '../../lib/vtt/select-file.js'

export default class FftVideoSplitCopy extends BaseCommand {
  static aliases = ['fft:vsc']
  static args = {
    video: Args.string({description: '源 mp4 文件(省略则扫描当前目录交互选择)'}),
  }
  static description = '对 mp4 进行无损快速切割(不重编码): 逐段录入起止时间, 每段输出一个片段'
  static examples = [
    '<%= config.bin %> <%= command.id %> input.mp4',
    '<%= config.bin %> <%= command.id %> input.mp4 --start 00:00:10 --end 00:00:30',
    '<%= config.bin %> <%= command.id %>',
  ]
  static flags = {
    end: Flags.string({
      description: '结束时间(如 00:00:30 或 30); 与 --start 同时提供时直接切单段',
    }),
    start: Flags.string({
      description: '开始时间(如 00:00:10 或 10); 与 --end 同时提供时直接切单段',
    }),
  }

  public async run(): Promise<{outputPaths: string[]; videoPath: string}> {
    const {args, flags} = await this.parse(FftVideoSplitCopy)

    // #region 参数与 JSON 模式前置校验
    const startText = flags.start
    const endText = flags.end
    if ((startText === undefined) !== (endText === undefined)) {
      this.error('--start 与 --end 必须同时提供, 否则无法确定单段区间')
    }

    if (!args.video) this.rejectInteractionInJsonMode('<video> 参数')
    if (startText === undefined || endText === undefined) {
      this.rejectInteractionInJsonMode('--start 与 --end 参数(交互式多段录入无法在 --json 下执行)')
    }
    // #endregion

    // #region 选择源视频
    const videoPath = args.video ?? (await selectFile(['.mp4', '.webm'], '请选择要切割的文件:'))
    if (!existsSync(videoPath)) this.error(`文件不存在: ${videoPath}`)
    // #endregion

    const splitter = new VideoSegmentSplitter(videoPath, {logger: this})

    if (startText !== undefined && endText !== undefined) {
      // #region 直接切单段
      const rangeCheck = validateSegmentRange(startText, endText)
      if (rangeCheck !== true) this.error(`时间区间无效: ${rangeCheck}`)

      await splitter.splitSegment(startText, endText)
      // #endregion
    } else {
      // #region 交互式多段
      this.log('将逐段录入起止时间, 每段完成后可决定是否继续; 按 Esc 结束录入')
      await splitter.runInteractive()
      // #endregion
    }

    if (splitter.outputPaths.length === 0) this.log('未录入任何片段, 已结束')
    return {outputPaths: splitter.outputPaths, videoPath}
  }
}
