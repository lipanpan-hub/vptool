import {Args, Flags} from '@oclif/core'
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {basename, dirname, extname, join} from 'node:path'

import {BaseCommand} from '../../lib/base-command.js'
import {selectFile} from '../../lib/vtt/select-file.js'
import {srtToSingleCueVtt, srtToVtt} from '../../lib/vtt/srt-to-vtt.js'

export default class VttSrt2vtt extends BaseCommand {
  static args = {
    srt: Args.string({description: 'SRT 字幕文件路径(省略则从当前目录交互选择)', required: false}),
  }

  static description = '将 SRT 字幕转换为 VTT 字幕'

  static examples = [
    '<%= config.bin %> <%= command.id %> demo.srt',
    '<%= config.bin %> <%= command.id %> demo.srt -o out.vtt',
    '<%= config.bin %> <%= command.id %> demo.srt -m',
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    multi: Flags.boolean({char: 'm', description: '输出多 cue 版本: 每条原 cue 单独成块(默认合并为单条 cue 并内嵌各 cue 起始时间戳)'}),
    output: Flags.string({char: 'o', description: '输出文件路径(默认在原文件旁生成 *.vtt 或 *.multi.vtt)'}),
  }

  public async run(): Promise<{inputPath: string; outputPath: string}> {
    const {args, flags} = await this.parse(VttSrt2vtt)

    if (!args.srt) this.rejectInteractionInJsonMode('<srt> 参数')
    const inputPath = args.srt ?? (await selectFile(['.srt'], '请选择 SRT 字幕文件:'))

    if (!existsSync(inputPath)) {
      this.error(`文件不存在: ${inputPath}`)
    }

    const content = readFileSync(inputPath, 'utf8')
    const result = flags.multi ? srtToVtt(content) : srtToSingleCueVtt(content)

    // 默认在原文件旁生成 <名称>.vtt(多 cue 版本加 .multi 后缀)
    const name = basename(inputPath, extname(inputPath))
    const outputPath = flags.output ?? join(dirname(inputPath), `${name}${flags.multi ? '.multi' : ''}.vtt`)
    writeFileSync(outputPath, result, 'utf8')

    this.log(`已生成: ${outputPath}`)

    return {inputPath, outputPath}
  }
}
