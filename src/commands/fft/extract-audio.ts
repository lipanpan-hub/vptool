import {Args, Command} from '@oclif/core'
import {existsSync} from 'node:fs'
import prompts from 'prompts'

import {extractAudioCopy} from '../../lib/fft/extract-audio-copy.js'
import {selectFile} from '../../lib/vtt/select-file.js'

export default class FftExtractAudio extends Command {
  static aliases = ['fft:ea']

  static args = {
    video: Args.string({description: '源 mp4 文件(省略则扫描当前目录交互选择)'}),
  }

  static description = '从 mp4 中无损抽取原始音频流(不重编码), 输出同名 m4a 文件'

  static examples = [
    '<%= config.bin %> <%= command.id %> input.mp4',
    '<%= config.bin %> <%= command.id %>',
  ]

  public async run(): Promise<void> {
    const {args} = await this.parse(FftExtractAudio)

    const videoPath = args.video ?? (await selectFile(['.mp4'], '请选择源 mp4 文件:'))

    if (!existsSync(videoPath)) this.error(`文件不存在: ${videoPath}`)

    // 输出已存在时先询问是否覆盖, 避免误删旧文件
    const audioPath = videoPath.replace(/\.[^.]+$/, '.m4a')
    if (existsSync(audioPath)) {
      const {overwrite} = await prompts({
        message: `${audioPath} 已存在, 是否覆盖?`,
        name: 'overwrite',
        type: 'confirm',
      })
      if (!overwrite) {
        this.log('已取消')
        return
      }
    }

    await extractAudioCopy(videoPath, this)
  }
}
