import type {ParsedArticle, WechatArticleProvider} from './provider.js'

// 接口规格: url 为完整请求地址(便于接入不同平台的 API)
interface ProviderSpec {
  id: string
  title: string
  url: string
}

const SPECS: ProviderSpec[] = [
  {
    id: 'tikhub-h5',
    title: 'TikHub 微信公众号 /v2/fetch_article_detail_h5 (推荐, 字段最全)',
    url: 'https://api.tikhub.io/api/v1/wechat_mp/v2/fetch_article_detail_h5',
  },
  {
    id: 'tikhub',
    title: 'TikHub 微信公众号 /v2/fetch_article_detail (响应快, 字段较少)',
    url: 'https://api.tikhub.io/api/v1/wechat_mp/v2/fetch_article_detail',
  },
]

async function requestJson(url: string, articleUrl: string, token: string): Promise<any> {
  const res = await fetch(url, {
    body: JSON.stringify({raw: false, url: articleUrl}),
    headers: {Accept: 'application/json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    method: 'POST',
  })
  const json = (await res.json()) as any
  if (!res.ok || json?.code !== 200) {
    const msg = json?.detail?.message || json?.message || `HTTP ${res.status}`
    throw new Error(`接口请求失败: ${msg}`)
  }

  return json
}

function parseArticle(json: any): ParsedArticle {
  // 实际返回结构为 data.content.*(与需求注释里的 data.* 有出入, 以真实结构为准)
  const content = json?.data?.content
  if (!content) {
    throw new Error('接口未返回文章数据, 可尝试更换其他接口')
  }

  const contentText = content.content_text ?? ''
  if (!contentText) {
    throw new Error('接口返回的文章正文为空, 无法保存')
  }

  return {
    contentText,
    createTime: content.create_time ?? '',
    nickName: content.nick_name ?? '',
    title: content.title ?? '',
  }
}

// 由规格生成 provider 策略实例
export const providers: WechatArticleProvider[] = SPECS.map((spec) => ({
  async fetchArticle(articleUrl: string, token: string): Promise<ParsedArticle> {
    return parseArticle(await requestJson(spec.url, articleUrl, token))
  },
  id: spec.id,
  title: spec.title,
}))

export function findProvider(id: string): undefined | WechatArticleProvider {
  return providers.find((p) => p.id === id)
}
