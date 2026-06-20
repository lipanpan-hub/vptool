import {Args, Command, Flags} from '@oclif/core'
import Fuse from 'fuse.js'
import {existsSync, readdirSync, readFileSync, writeFileSync} from 'node:fs'
import {basename, dirname, extname, join, resolve} from 'node:path'
import prompts from 'prompts'

import {extractText, zipVtt} from '../../lib/vtt/zip-vtt.js'

function defaultOutputPath(inputPath: string, ext: string): string {
  // 默认在原文件旁生成 <名称>.zip.vtt 或 <名称>.txt
  const inputExt = extname(inputPath)
  const name = basename(inputPath, inputExt)
  return join(dirname(inputPath), `${name}${ext}`)
}

async function pickVttFile(): Promise<string> {
  // 扫描当前目录下所有 .vtt 文件
  const files = readdirSync(process.cwd()).filter((f) => f.endsWith('.vtt'))
  if (files.length === 0) throw new Error('当前目录下没有找到 .vtt 文件')

  const choices = files.map((f) => ({title: f, value: resolve(process.cwd(), f)}))
  const fuse = new Fuse(choices, {keys: ['title'], threshold: 0.4})

  const response = await prompts({
    choices,
    message: '请选择要处理的 VTT 文件:',
    name: 'file',
    suggest: async (input: string, ch: any[]) => {
      if (!input) return ch
      return fuse.search(input).map((r) => r.item)
    },
    type: 'autocomplete',
  })

  if (!response.file) throw new Error('未选择文件，操作取消')
  return response.file
}

export default class VttZip extends Command {
  static args = {
    file: Args.string({description: 'VTT 字幕文件路径(省略则从当前目录交互选择)', required: false}),
  }

  static description = '将 VTT 多行字幕压缩为单行,去除说话人信息并完整保留单词级时间戳'

  static examples = [
    '<%= config.bin %> <%= command.id %> demo.vtt',
    '<%= config.bin %> <%= command.id %> demo.vtt -o out.vtt',
    '<%= config.bin %> <%= command.id %> demo.vtt -t',
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    output: Flags.string({char: 'o', description: '输出文件路径(默认在原文件旁生成 *.zip.vtt 或 *.txt)'}),
    text: Flags.boolean({char: 't', description: '提取纯文本:去除时间戳与所有字幕格式,仅保留文字'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(VttZip)

    const inputPath = args.file ?? (await pickVttFile())

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
