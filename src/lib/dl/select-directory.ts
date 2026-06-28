import Fuse from 'fuse.js'
import prompts from 'prompts'

interface DirEntry {
  depth: number
  fullPath: string
  name: string
}

export async function selectDirectory(dirs: DirEntry[], initialInput?: string): Promise<string> {
  // 构建 choices：缩进展示层级，value 为 fullPath
  const choices = dirs.map((d) => ({
    title: d.depth < 0 ? d.name : '  '.repeat(d.depth) + d.name,
    value: d.fullPath,
  }))

  const fuse = new Fuse(choices, {keys: ['title'], threshold: 0.4})

  const response = await prompts({
    choices,
    initial: initialInput ? choices.findIndex((c) => c.title.trim().includes(initialInput)) : 0,
    message: '选择要进入的目录（可输入名称模糊筛选）:',
    name: 'dir',
    suggest: async (input: string, list: any[]) => {
      if (!input) return list
      return fuse.search(input).map((r) => r.item)
    },
    limit:30,
    type: 'autocomplete',
  })

  const dir: string | undefined = response.dir
  if (!dir) throw new Error('未选择目录，操作取消')
  return dir
}
