// 这个命令的作用是借助 ffmpeg atempo 对音频调速(变速不变调)
// 扫描当前目录让用户交互式选择音频, 再输入速度倍率后执行

import {Args, Command} from '@oclif/core'
import {existsSync} from 'node:fs'
import prompts from 'prompts'

import {buildSpeedChangedPath, changeAudioSpeed, formatSpeed, isValidSpeed} from '../../lib/fft/change-speed.js'
import {selectFile} from '../../lib/vtt/select-file.js'

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.wma']

export default class FftChangeSpeed extends Command {
  static aliases = ['fft:cs']

  static args = {
    audio: Args.string({description: '源音频文件(省略则扫描当前目录交互选择)'}),
    speed: Args.string({description: '速度倍率, 大于 1 加速、小于 1 减速(省略则交互输入)'}),
  }

  static description = '借助 ffmpeg atempo 对音频调速(变速不变调, 保持原音色)'

  static examples = [
    '<%= config.bin %> <%= command.id %> input.mp3 1.5',
    '<%= config.bin %> <%= command.id %> input.mp3 0.8',
    '<%= config.bin %> <%= command.id %>',
  ]

  public async run(): Promise<void> {
    const {args} = await this.parse(FftChangeSpeed)

    // #region 选择源音频
    const audioPath = args.audio ?? (await selectFile(AUDIO_EXTENSIONS, '请选择要调速的音频文件:'))
    if (!existsSync(audioPath)) this.error(`文件不存在: ${audioPath}`)
    // #endregion

    // #region 获取速度倍率
    const speed = await this.resolveSpeed(args.speed)
    if (speed === null) {
      this.log('已取消')
      return
    }
    // #endregion

    // #region 输出已存在时先询问是否覆盖
    const outputPath = buildSpeedChangedPath(audioPath, speed)
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

    // #region 执行调速
    this.log(`正在把 ${audioPath} 调速到 ${formatSpeed(speed)}x...`)
    await changeAudioSpeed(audioPath, speed, this)
    // #endregion
  }

  // 优先取命令行参数, 缺省时交互式询问; 返回 null 表示用户取消
  private async resolveSpeed(raw?: string): Promise<null | number> {
    if (raw !== undefined) {
      const speed = Number(raw)
      if (!isValidSpeed(speed)) this.error(`速度倍率必须为正数: ${raw}`)
      return speed
    }

    const {speed} = await prompts({
      message: '速度倍率(大于 1 加速, 小于 1 减速, 如 1.5):',
      name: 'speed',
      type: 'text',
      validate: (value: string) => (isValidSpeed(Number(value)) ? true : '速度倍率必须为正数'),
    })

    return speed ? Number(speed) : null
  }
}