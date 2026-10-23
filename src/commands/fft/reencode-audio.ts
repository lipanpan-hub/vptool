// 这个命令的作用是把音频重新编码为目标格式
// 扫描当前目录让用户交互式选择音频, 再交互式选择目标格式后重新编码

import {Args} from '@oclif/core'
import {existsSync} from 'node:fs'
import prompts from 'prompts'

import {BaseCommand} from '../../lib/base-command.js'
import {AUDIO_TARGET_FORMATS, buildReencodedPath, reencodeAudio} from '../../lib/fft/reencode-audio.js'
import {selectFile} from '../../lib/vtt/select-file.js'

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.wma']

export default class FftReencodeAudio extends BaseCommand {
  static aliases = ['fft:ra']

  static args = {
    audio: Args.string({description: '源音频文件(省略则扫描当前目录交互选择)'}),
  }

  static description = '把音频重新编码为目标格式(交互式选择源文件与目标格式)'

  static examples = [
    '<%= config.bin %> <%= command.id %> input.wav',
    '<%= config.bin %> <%= command.id %>',
  ]

  public async run(): Promise<{audioPath: string; outputPath: null | string}> {
    const {args} = await this.parse(FftReencodeAudio)

    // 目标格式只能交互选择, 没有对应参数可规避
    this.rejectInteractiveOnlyInJsonMode('目标格式只能交互选择')

    // #region 选择源音频
    const audioPath = args.audio ?? (await selectFile(AUDIO_EXTENSIONS, '请选择要重新编码的音频文件:'))
    if (!existsSync(audioPath)) this.error(`文件不存在: ${audioPath}`)
    // #endregion

    // #region 交互式选择目标格式
    const {target} = await prompts({
      choices: AUDIO_TARGET_FORMATS.map((format) => ({
        description: format.description,
        title: format.label,
        value: format,
      })),
      message: '请选择目标格式:',
      name: 'target',
      type: 'select',
    })
    if (!target) {
      this.log('已取消')
      return {audioPath, outputPath: null}
    }
    // #endregion

    // #region 输出已存在时先询问是否覆盖
    const outputPath = buildReencodedPath(audioPath, target.extension)
    if (existsSync(outputPath)) {
      const {overwrite} = await prompts({
        message: `${outputPath} 已存在, 是否覆盖?`,
        name: 'overwrite',
        type: 'confirm',
      })
      if (!overwrite) {
        this.log('已取消')
        return {audioPath, outputPath: null}
      }
    }
    // #endregion

    // #region 执行重新编码
    this.log(`正在把 ${audioPath} 重新编码为 ${target.label}...`)
    const reencodedPath = await reencodeAudio(audioPath, target, this)
    // #endregion

    return {audioPath, outputPath: reencodedPath}
  }
}