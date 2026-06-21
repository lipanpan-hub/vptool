import {Args, Command, Flags} from '@oclif/core'
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {basename, dirname, extname, join} from 'node:path'

import {restampSegments} from '../../lib/vtt/restamp.js'
import {selectFile} from '../../lib/vtt/select-file.js'

export default class VttRestamp extends Command {
  static args = {
    vtt: Args.string({description: '含逐词时间戳的源 VTT 文件(省略则扫描当前目录交互选择)'}),
    text: Args.string({description: '重新分段后的纯文本文件(省略则扫描当前目录交互选择)'}),
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

    const vttPath = args.vtt ?? (await selectFile(['.vtt'], '请选择源 VTT 文件:'))
    const textPath = args.text ?? (await selectFile(['.txt'], '请选择重新分段的文本文件:'))

    if (!existsSync(vttPath)) this.error(`文件不存在: ${vttPath}`)
    if (!existsSync(textPath)) this.error(`文件不存在: ${textPath}`)

    const result = restampSegments(readFileSync(vttPath, 'utf-8'), readFileSync(textPath, 'utf-8'))

    const name = basename(textPath, extname(textPath))
    const outputPath = flags.output ?? join(dirname(textPath), `${name}.restamp.vtt`)
    writeFileSync(outputPath, result, 'utf-8')

    this.log(`已生成: ${outputPath}`)
  }
}
