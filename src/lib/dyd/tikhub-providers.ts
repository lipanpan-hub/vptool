import type {DouyinProvider, ParsedVideo, ResolvedInput} from './provider.js'

// 接口规格: url 为完整请求地址(便于接入不同网站的 API), param 决定参数类型(aweme_id 或 share_url)
interface ProviderSpec {
  id: string
  param: 'aweme_id' | 'share_url'
  title: string
  url: string
}

const SPECS: ProviderSpec[] = [
  {id: 'app-v1', param: 'aweme_id', title: 'App V3 /fetch_one_video (aweme_id)', url: 'https://api.tikhub.io/api/v1/douyin/app/v3/fetch_one_video'},
  {id: 'app-v2', param: 'aweme_id', title: 'App V3 /fetch_one_video_v2 (aweme_id)', url: 'https://api.tikhub.io/api/v1/douyin/app/v3/fetch_one_video_v2'},
  {id: 'app-v3', param: 'aweme_id', title: 'App V3 /fetch_one_video_v3 (aweme_id, 解决版权限制)', url: 'https://api.tikhub.io/api/v1/douyin/app/v3/fetch_one_video_v3'},
  {id: 'app-share', param: 'share_url', title: 'App V3 /fetch_one_video_by_share_url (分享链接)', url: 'https://api.tikhub.io/api/v1/douyin/app/v3/fetch_one_video_by_share_url'},
  {id: 'web-share', param: 'share_url', title: 'Web /fetch_one_video_by_share_url (分享链接, 画质更高)', url: 'https://api.tikhub.io/api/v1/douyin/web/fetch_one_video_by_share_url'},
  {id: 'web-v2', param: 'aweme_id', title: 'Web /fetch_one_video_v2 (aweme_id)', url: 'https://api.tikhub.io/api/v1/douyin/web/fetch_one_video_v2'},
  {id: 'web-v1', param: 'aweme_id', title: 'Web /fetch_one_video (aweme_id)', url: 'https://api.tikhub.io/api/v1/douyin/web/fetch_one_video'},
]

async function requestJson(url: string, token: string): Promise<any> {
  const res = await fetch(url, {headers: {Accept: 'application/json', Authorization: `Bearer ${token}`}})
  const json = (await res.json()) as any
  if (!res.ok || json?.code !== 200) {
    const msg = json?.detail?.message || json?.message || `HTTP ${res.status}`
    throw new Error(`接口请求失败: ${msg}`)
  }

  return json
}

function pickBestUrl(video: any): string {
  // 优先从多档清晰度中挑选面积最大、码率最高的一档, 取其播放直链
  const gears: any[] = Array.isArray(video?.bit_rate) ? video.bit_rate : []
  if (gears.length > 0) {
    const best = gears.reduce((a, b) => {
      const areaA = (a.play_addr?.width || 0) * (a.play_addr?.height || 0)
      const areaB = (b.play_addr?.width || 0) * (b.play_addr?.height || 0)
      if (areaB !== areaA) return areaB > areaA ? b : a
      return (b.bit_rate || 0) > (a.bit_rate || 0) ? b : a
    })
    const url = best.play_addr?.url_list?.[0]
    if (url) return url
  }

  // 降级: 使用默认 play_addr
  const fallback = video?.play_addr?.url_list?.[0]
  if (fallback) return fallback
  throw new Error('响应中未找到可用的视频下载地址')
}

function parseAwemeDetail(json: any): ParsedVideo {
  const detail = json?.data?.aweme_detail
  if (!detail) {
    // 命中过滤时给出原因码, 便于用户换接口重试
    const reason = json?.data?.filter_list?.[0]?.reason ?? json?.data?.filter_detail?.filter_reason
    throw new Error(`接口未返回视频数据${reason === undefined ? '' : ` (过滤原因: ${reason})`}, 可尝试更换其他接口`)
  }

  return {
    awemeId: detail.aweme_id || '',
    desc: detail.desc || '',
    videoUrl: pickBestUrl(detail.video),
  }
}

// 由规格生成 provider 策略实例
export const providers: DouyinProvider[] = SPECS.map((spec) => ({
  async fetchVideo(input: ResolvedInput, token: string): Promise<ParsedVideo> {
    const value = spec.param === 'aweme_id' ? input.awemeId : input.shareUrl
    const url = `${spec.url}?${spec.param}=${encodeURIComponent(value)}`
    return parseAwemeDetail(await requestJson(url, token))
  },
  id: spec.id,
  title: spec.title,
}))

export function findProvider(id: string): DouyinProvider | undefined {
  return providers.find((p) => p.id === id)
}
