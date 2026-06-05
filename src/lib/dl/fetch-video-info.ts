import {type VideoInfo, YtDlp} from 'ytdlp-nodejs'

export async function fetchVideoInfo(url: string, useCookies: boolean): Promise<VideoInfo> {
  const ytDlp = new YtDlp()
  const options = useCookies ? {cookiesFromBrowser: 'firefox' as const} : {}
  const videoInfo = (await ytDlp.getInfoAsync(url, options)) as VideoInfo
  if (!videoInfo) {
    throw new Error('无法获取视频信息')
  }

  return videoInfo
}
