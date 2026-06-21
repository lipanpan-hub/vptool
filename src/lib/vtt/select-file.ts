import Fuse from 'fuse.js'
import {readdirSync} from 'node:fs'
import prompts from 'prompts'

export async function selectFile(extensions: string[], message: string): Promise<string> {
  // 扫描当前目录,筛选指定扩展名的文件供 prompts+fuse.js 交互选择
  const files = readdirSync(process.cwd(), {withFileTypes: true})
    .filter((e) => e.isFile() && extensions.some((ext) => e.name.toLowerCase().endsWith(ext)))
    .map((e) => e.name)

  if (files.length === 0) {
    throw new Error(`当前目录未找到 ${extensions.join('/')} 文件`)
  }

  const choices = files.map((name) => ({title: name, value: name}))
  const fuse = new Fuse(choices, {keys: ['title'], threshold: 0.3})

  const response = await prompts({
    choices,
    message,
    name: 'file',
    suggest: async (input: string, items: any[]) => {
      if (!input) return items
      return fuse.search(input).map((r) => r.item)
    },
    type: 'autocomplete',
  })

  if (!response.file) {
    throw new Error('未选择文件')
  }

  return response.file
}