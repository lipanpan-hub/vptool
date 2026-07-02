import type {ResolvedInput} from './provider.js'

function extractUrl(raw: string): null | string {
  // 分享文案里混杂中文与表情, 提取第一个 http(s) 链接
  const match = raw.match(/https?:\/\/[^\s]+/)
  return match ? match[0] : null
}

function extractAwemeId(url: string): null | string {
  // 依次匹配 /video/{id}、/share/video/{id}、/note/{id}、?modal_id={id}
  const patterns = [/\/video\/(\d+)/, /\/share\/video\/(\d+)/, /\/note\/(\d+)/, /[?&]modal_id=(\d+)/]
  for (const re of patterns) {
    const m = url.match(re)
    if (m) return m[1]
  }

  return null
}

async function followRedirect(url: string): Promise<string> {
  // 跟随短链跳转拿到含 aweme_id 的最终地址, 立即取消响应体避免下载页面内容
  const res = await fetch(url, {redirect: 'follow'})
  res.body?.cancel()
  return res.url
}

export async function resolveInput(raw: string): Promise<ResolvedInput> {
  const url = extractUrl(raw)
  if (!url) {
    throw new Error('未能从输入中识别出抖音链接, 请粘贴分享文案或视频链接')
  }

  // 直链已含 id 则免去一次网络请求, 否则跟随短链跳转解析
  let awemeId = extractAwemeId(url)
  if (!awemeId) {
    const finalUrl = await followRedirect(url)
    awemeId = extractAwemeId(finalUrl)
  }

  if (!awemeId) {
    throw new Error(`无法从链接中解析出视频 ID: ${url}`)
  }

  return {awemeId, shareUrl: url}
}
