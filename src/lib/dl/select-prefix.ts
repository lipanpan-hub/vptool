import Fuse from 'fuse.js'
import prompts from 'prompts'

import {addDlPrefix, readDlPrefix} from '../config/read-config.js'

export async function selectPrefix(configDir: string): Promise<string> {
  const prefixes = readDlPrefix(configDir)

  // 构建选项: 首项为默认 x 目录, 其余来自配置文件
  const choices = [
    {title: '（默认 x 目录）', value: 'x'},
    ...prefixes.map((p) => ({title: p, value: p})),
  ]

  const fuse = new Fuse(choices, {keys: ['title', 'value'], threshold: 0.3})

  const response = await prompts({
    choices,
    message: '请选择保存目录 prefix（可直接输入自定义值）:',
    name: 'prefix',
    suggest: async (input: string, list: any[]) => {
      if (!input) return list
      const matched = fuse.search(input).map((r) => r.item)
      // 输入值不在已有选项中时, 把它作为新建候选项放到最前, 供用户直接选中
      const exists = list.some((c) => c.value === input)
      return exists ? matched : [{title: `新建: ${input}`, value: input}, ...matched]
    },
    type: 'autocomplete',
  })

  const prefix: string | undefined = response.prefix
  if (prefix === undefined) {
    throw new Error('未选择 prefix，取消下载')
  }

  // 选中的是 choices 中不存在的新值时, 询问是否保存到配置文件
  if (prefix && !choices.some((c) => c.value === prefix)) {
    const {save} = await prompts({
      message: `是否将 prefix "${prefix}" 保存到配置文件?`,
      name: 'save',
      type: 'confirm',
    })
    if (save) {
      addDlPrefix(configDir, prefix)
    }
  }

  return prefix
}
