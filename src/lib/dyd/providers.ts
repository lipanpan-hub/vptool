import prompts from 'prompts'

import {type DouyinInput} from './input.js'

export type DouyinProviderInputKind = 'aweme_id' | 'share_url'

export interface DouyinVideoProvider {
  description: string
  endpoint: string
  id: string
  inputKind: DouyinProviderInputKind
  title: string
}

export const DOUYIN_VIDEO_PROVIDERS: DouyinVideoProvider[] = [
  {
    description: 'APP V1: 获取单个作品数据，支持图文、视频等',
    endpoint: '/api/v1/douyin/app/v3/fetch_one_video',
    id: 'app-v1',
    inputKind: 'aweme_id',
    title: 'APP fetch_one_video',
  },
  {
    description: 'APP V2: 获取单个作品数据，支持图文、视频等',
    endpoint: '/api/v1/douyin/app/v3/fetch_one_video_v2',
    id: 'app-v2',
    inputKind: 'aweme_id',
    title: 'APP fetch_one_video_v2',
  },
  {
    description: 'APP V3: 支持更多受限内容',
    endpoint: '/api/v1/douyin/app/v3/fetch_one_video_v3',
    id: 'app-v3',
    inputKind: 'aweme_id',
    title: 'APP fetch_one_video_v3',
  },
  {
    description: 'APP: 根据分享链接获取单个作品数据',
    endpoint: '/api/v1/douyin/app/v3/fetch_one_video_by_share_url',
    id: 'app-share-url',
    inputKind: 'share_url',
    title: 'APP fetch_one_video_by_share_url',
  },
  {
    description: 'WEB: 根据分享链接获取单个作品数据，画质通常更高',
    endpoint: '/api/v1/douyin/web/fetch_one_video_by_share_url',
    id: 'web-share-url',
    inputKind: 'share_url',
    title: 'WEB fetch_one_video_by_share_url',
  },
  {
    description: 'WEB V2: 根据 aweme_id 获取单个作品数据',
    endpoint: '/api/v1/douyin/web/fetch_one_video_v2',
    id: 'web-v2',
    inputKind: 'aweme_id',
    title: 'WEB fetch_one_video_v2',
  },
  {
    description: 'WEB V1: 根据 aweme_id 获取单个作品数据',
    endpoint: '/api/v1/douyin/web/fetch_one_video',
    id: 'web-v1',
    inputKind: 'aweme_id',
    title: 'WEB fetch_one_video',
  },
]

export function findDouyinVideoProvider(id: string): DouyinVideoProvider | undefined {
  return DOUYIN_VIDEO_PROVIDERS.find((provider) => provider.id === id)
}

export function getCompatibleProviders(input: DouyinInput): DouyinVideoProvider[] {
  return DOUYIN_VIDEO_PROVIDERS.filter((provider) => {
    if (provider.inputKind === 'aweme_id') return Boolean(input.awemeId)
    return Boolean(input.shareUrl)
  })
}

export function getProviderInput(provider: DouyinVideoProvider, input: DouyinInput): string {
  if (provider.inputKind === 'aweme_id') {
    if (!input.awemeId) {
      throw new Error(`provider ${provider.id} 需要 aweme_id，但输入中未解析到作品 ID`)
    }

    return input.awemeId
  }

  if (!input.shareUrl) {
    throw new Error(`provider ${provider.id} 需要分享链接，但输入中未解析到 URL`)
  }

  return input.shareUrl
}

export async function selectDouyinVideoProvider(input: DouyinInput): Promise<DouyinVideoProvider> {
  const providers = getCompatibleProviders(input)
  if (providers.length === 0) {
    throw new Error('输入中未解析到可用的抖音作品 ID 或分享链接')
  }

  const response = await prompts({
    choices: providers.map((provider) => ({
      description: provider.description,
      title: `${provider.id} - ${provider.title}`,
      value: provider.id,
    })),
    message: '请选择用于解析视频地址的接口 provider:',
    name: 'provider',
    type: 'select',
  })

  const providerId = response.provider as string | undefined
  if (!providerId) {
    throw new Error('未选择 provider，取消下载')
  }

  const provider = findDouyinVideoProvider(providerId)
  if (!provider) {
    throw new Error(`未知 provider: ${providerId}`)
  }

  return provider
}
