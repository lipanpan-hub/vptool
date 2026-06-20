import {Args, Command, Flags} from '@oclif/core'
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {basename, dirname, extname, join} from 'node:path'

import {extractText, zipVtt} from '../../lib/vtt/zip-vtt.js'

function defaultOutputPath(inputPath: string, ext: string): string {
  // 默认在原文件旁生成 <名称>.zip.vtt 或 <名称>.txt
  const inputExt = extname(inputPath)
  const name = basename(inputPath, inputExt)
  return join(dirname(inputPath), `${name}${ext}`)
}

export default class VttZip extends Command {
  static args = {
    file: Args.string({description: 'VTT 字幕文件路径', required: true}),
  }

  static description = '将 VTT 多行字幕压缩为单行,去除说话人信息并完整保留单词级时间戳'

  static examples = [
    '<%= config.bin %> <%= command.id %> demo.vtt',
    '<%= config.bin %> <%= command.id %> demo.vtt -o out.vtt',
    '<%= config.bin %> <%= command.id %> demo.vtt -t',
  ]

  static flags = {
    output: Flags.string({char: 'o', description: '输出文件路径(默认在原文件旁生成 *.zip.vtt 或 *.txt)'}),
    text: Flags.boolean({char: 't', description: '提取纯文本:去除时间戳与所有字幕格式,仅保留文字'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(VttZip)
    const inputPath = args.file

    if (!existsSync(inputPath)) {
      this.error(`文件不存在: ${inputPath}`)
    }

    const content = readFileSync(inputPath, 'utf-8')
    const result = flags.text ? extractText(content) : zipVtt(content)

    const outputPath = flags.output ?? defaultOutputPath(inputPath, flags.text ? '.txt' : '.zip.vtt')
    writeFileSync(outputPath, result, 'utf-8')

    this.log(`已生成: ${outputPath}`)
  }
}
