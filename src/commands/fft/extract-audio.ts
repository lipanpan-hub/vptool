import {Args} from '@oclif/core'
import {existsSync} from 'node:fs'
import prompts from 'prompts'

import {BaseCommand} from '../../lib/base-command.js'
import {extractAudioCopy} from '../../lib/fft/extract-audio-copy.js'
import {selectFile} from '../../lib/vtt/select-file.js'

export default class FftExtractAudio extends BaseCommand {
  static aliases = ['fft:ea']

  static args = {
    video: Args.string({description: '源 mp4 文件(省略则扫描当前目录交互选择)'}),
  }

  static description = '从 mp4 中无损抽取原始音频流(不重编码), 输出同名 m4a 文件'

  static examples = [
    '<%= config.bin %> <%= command.id %> input.mp4',
    '<%= config.bin %> <%= command.id %>',
  ]

  public async run(): Promise<{outputPath: null | string; videoPath: string}> {
    const {args} = await this.parse(FftExtractAudio)

    if (!args.video) this.rejectInteractionInJsonMode('<video> 参数')
    const videoPath = args.video ?? (await selectFile(['.mp4'], '请选择源 mp4 文件:'))

    if (!existsSync(videoPath)) this.error(`文件不存在: ${videoPath}`)

    // 输出已存在时先询问是否覆盖, 避免误删旧文件
    const audioPath = videoPath.replace(/\.[^.]+$/, '.m4a')
    if (existsSync(audioPath)) {
      this.rejectInteractionInJsonMode(`先删除已存在的输出文件 ${audioPath}(该命令无 --force, 覆盖需交互确认)`)
      const {overwrite} = await prompts({
        message: `${audioPath} 已存在, 是否覆盖?`,
        name: 'overwrite',
        type: 'confirm',
      })
      if (!overwrite) {
        this.log('已取消')
        return {outputPath: null, videoPath}
      }
    }

    const outputPath = await extractAudioCopy(videoPath, this)
    return {outputPath, videoPath}
  }
}
