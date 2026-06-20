import {Args, Command, Flags} from '@oclif/core'
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {basename, dirname, extname, join} from 'node:path'

import {restampSegments} from '../../lib/vtt/restamp.js'

export default class VttRestamp extends Command {
  static args = {
    vtt: Args.string({description: '含逐词时间戳的源 VTT 文件', required: true}),
    text: Args.string({description: '重新分段后的纯文本文件', required: true}),
  }

  static description = '依据源 VTT 的逐词时间戳,为重新分段的文本逐段打上内嵌时间戳,每个段落生成一个 cue'

  static examples = [
    '<%= config.bin %> <%= command.id %> demo.zip.vtt demo2.txt',
    '<%= config.bin %> <%= command.id %> demo.zip.vtt demo2.txt -o out.vtt',
  ]

  static flags = {
    output: Flags.string({char: 'o', description: '输出文件路径(默认在文本文件旁生成 *.restamp.vtt)'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(VttRestamp)

    if (!existsSync(args.vtt)) this.error(`文件不存在: ${args.vtt}`)
    if (!existsSync(args.text)) this.error(`文件不存在: ${args.text}`)

    const result = restampSegments(readFileSync(args.vtt, 'utf-8'), readFileSync(args.text, 'utf-8'))

    const name = basename(args.text, extname(args.text))
    const outputPath = flags.output ?? join(dirname(args.text), `${name}.restamp.vtt`)
    writeFileSync(outputPath, result, 'utf-8')

    this.log(`已生成: ${outputPath}`)
  }
}
