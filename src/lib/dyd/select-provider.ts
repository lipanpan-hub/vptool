import prompts from 'prompts'

import type {DouyinProvider} from './provider.js'

import {providers} from './tikhub-providers.js'

export async function selectProvider(): Promise<DouyinProvider> {
  const response = await prompts({
    choices: providers.map((p) => ({title: p.title, value: p.id})),
    message: '请选择用于解析视频地址的接口:',
    name: 'id',
    type: 'select',
  })

  const provider = providers.find((p) => p.id === response.id)
  if (!provider) {
    throw new Error('未选择接口，已取消')
  }

  return provider
}
