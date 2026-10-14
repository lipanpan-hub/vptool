import Fuse from 'fuse.js'
import {readdirSync} from 'node:fs'
import prompts from 'prompts'

/** 必选: 从当前目录按扩展名筛选文件供模糊搜索选择, 无候选或未选中时报错 */
export async function selectFile(extensions: string[], message: string): Promise<string> {
  const selected = await pickFileFromCwd(extensions, message, false)
  return selected as string
}

/** 可跳过: 首项为跳过哨兵(空输入回车即命中), 返回 undefined 表示不指定文件 */
export async function selectOptionalFile(extensions: string[], message: string): Promise<string | undefined> {
  const selected = await pickFileFromCwd(extensions, message, true)
  return selected === '' ? undefined : selected
}

/** 交互选择骨架: 扫描当前目录 + fuse 模糊过滤 + prompts autocomplete; allowSkip 时首项插入跳过哨兵 */
async function pickFileFromCwd(extensions: string[], message: string, allowSkip: boolean): Promise<string | undefined> {
  const fileNames = readdirSync(process.cwd(), {withFileTypes: true})
    .filter((e) => e.isFile() && extensions.some((ext) => e.name.toLowerCase().endsWith(ext)))
    .map((e) => e.name)

  if (fileNames.length === 0 && !allowSkip) {
    throw new Error(`当前目录未找到 ${extensions.join('/')} 文件`)
  }

  const fileChoices = fileNames.map((name) => ({title: name, value: name}))
  // fuse 仅索引真实文件, 输入过滤词后跳过哨兵自然被排除
  const fuse = new Fuse(fileChoices, {keys: ['title'], threshold: 0.3})
  const choices = allowSkip ? [{title: '(跳过, 不指定)', value: ''}, ...fileChoices] : fileChoices

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

  if (response.file === undefined) {
    throw new Error('未选择文件')
  }
  return response.file
}
