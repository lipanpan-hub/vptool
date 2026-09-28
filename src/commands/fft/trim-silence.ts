// 这个命令的作用是切除音频中的静音片段, 只保留有人说话的片段
// 先用 silencedetect 检测静音区间, 再把非静音的语音片段拼接成新文件

import {Args, Command, Flags} from '@oclif/core'
import {existsSync} from 'node:fs'
import prompts from 'prompts'

import {buildTrimmedPath, normalizeThreshold, trimSilence} from '../../lib/fft/trim-silence.js'
import {selectFile} from '../../lib/vtt/select-file.js'

// 仅支持纯音频: 拼接时视频流无法同步裁剪, 强行处理会导致画面跳变
const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.wma']

export default class FftTrimSilence extends Command {
  static aliases = ['fft:ts']

  static args = {
    audio: Args.string({description: '源音频文件(省略则扫描当前目录交互选择)'}),
  }

  static description = '切除音频中的静音片段, 只保留有人说话的片段'

  static examples = [
    '<%= config.bin %> <%= command.id %> input.mp3',
    '<%= config.bin %> <%= command.id %> input.mp3 --threshold=-40dB --min-silence=0.8',
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    'min-silence': Flags.string({
      default: '0.5',
      description: '最短静音时长(秒), 只有达到该时长的静音才会被切除',
    }),
    padding: Flags.string({
      default: '0.1',
      description: '语音片段首尾保留的余量(秒), 避免削掉字头字尾',
    }),
    threshold: Flags.string({
      default: '-30dB',
      description: '静音判定阈值, 响度低于该值视为静音(如 -30dB)',
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(FftTrimSilence)

    // #region 选择源音频
    const audioPath = args.audio ?? (await selectFile(AUDIO_EXTENSIONS, '请选择要处理的音频文件:'))
    if (!existsSync(audioPath)) this.error(`文件不存在: ${audioPath}`)
    // #endregion

    // #region 解析并校验参数
    const minSilence = Number.parseFloat(flags['min-silence'])
    const padding = Number.parseFloat(flags.padding)

    if (!(minSilence > 0)) this.error(`最短静音时长必须为正数: ${flags['min-silence']}`)
    if (!(padding >= 0)) this.error(`保留余量不能为负数: ${flags.padding}`)
    // #endregion

    // #region 输出已存在时先询问是否覆盖
    const outputPath = buildTrimmedPath(audioPath)
    if (existsSync(outputPath)) {
      const {overwrite} = await prompts({
        message: `${outputPath} 已存在, 是否覆盖?`,
        name: 'overwrite',
        type: 'confirm',
      })
      if (!overwrite) {
        this.log('已取消')
        return
      }
    }
    // #endregion

    // #region 执行切除
    this.log(`正在检测并切除 ${audioPath} 中的静音片段...`)
    await trimSilence(audioPath, {
      minSilence,
      padding,
      threshold: normalizeThreshold(flags.threshold),
    }, this)
    // #endregion
  }
}
