import Fuse from 'fuse.js'
import prompts from 'prompts'
import type {VideoInfo} from 'ytdlp-nodejs'

export async function selectFormat(videoInfo: VideoInfo): Promise<string> {
  if (!videoInfo.formats || videoInfo.formats.length === 0) {
    throw new Error('该视频没有可用的下载格式')
  }

  // 准备格式选项
  const formatChoices = videoInfo.formats.map((format, index) => {
    const size = format.filesize 
      ? `${(format.filesize / 1024 / 1024).toFixed(2)} MB` 
      : '未知大小'
    
    const resolution = format.resolution || '音频'
    const ext = format.ext || 'unknown'
    const note = format.format_note || ''
    
    return {
      description: `[${format.format_id}] ${resolution} ${ext} - ${size} ${note}`,
      title: `${index + 1}. ${resolution} (${ext}) - ${size}`,
      value: format.format_id,
    }
  })

  // 配置 Fuse.js 进行模糊搜索
  const fuse = new Fuse(formatChoices, {
    keys: ['title', 'description', 'value'],
    threshold: 0.3,
  })

  // 交互式选择
  const response = await prompts({
    choices: formatChoices,
    message: '请选择要下载的视频格式:',
    name: 'formatId',
    suggest: async (input: string, choices: any[]) => {
      if (!input) return choices
      const results = fuse.search(input)
      return results.map((result) => result.item)
    },
    type: 'autocomplete',
  })

  if (!response.formatId) {
    throw new Error('未选择格式，取消下载')
  }

  return response.formatId
}
