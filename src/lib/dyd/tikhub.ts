import {requestText} from './http.js'
import {type DouyinInput} from './input.js'
import {type DouyinVideoProvider, getProviderInput} from './providers.js'

const API_BASE_URL = 'https://api.tikhub.io'

export async function fetchDouyinVideoData(
  provider: DouyinVideoProvider,
  input: DouyinInput,
  token: string,
): Promise<unknown> {
  const value = getProviderInput(provider, input)
  const url = new URL(provider.endpoint, API_BASE_URL)

  if (provider.inputKind === 'aweme_id') {
    url.searchParams.set('aweme_id', value)
    if (provider.id === 'web-v1') {
      url.searchParams.set('need_anchor_info', 'false')
    }
  } else {
    url.searchParams.set('share_url', value)
  }

  const response = await requestText(url, {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  })
  const {text} = response
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    // 保留原始文本, 下方错误会带出一小段响应内容
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const detail = typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)
    throw new Error(`TikHub 请求失败: HTTP ${response.statusCode} ${response.statusMessage} ${detail}`)
  }

  return body
}
