import prompts from 'prompts'
import type {VideoInfo} from 'ytdlp-nodejs'

interface SubtitleChoice {
  description: string
  title: string
  value: string
}

type SubtitleMap = Record<string, {ext: string; name: string; url: string}[]> | undefined

// 把字幕表转换成选项, 已在 seenLangs 中出现的语言不再重复列出(yt-dlp 同语言会优先下载人工字幕)
function toChoices(subtitleMap: SubtitleMap, label: string, seenLangs: Set<string>): SubtitleChoice[] {
  const choices: SubtitleChoice[] = []
  for (const [lang, tracks] of Object.entries(subtitleMap ?? {})) {
    if (lang === 'live_chat' || seenLangs.has(lang)) continue
    seenLangs.add(lang)
    const name = tracks[0]?.name ?? ''
    const exts = [...new Set(tracks.map((track) => track.ext))].join('/')
    choices.push({description: exts, title: `[${label}] ${lang} ${name}`, value: lang})
  }

  return choices
}

// 列出可用字幕并交互式多选, 返回语言代码列表
export async function selectSubtitleLangs(videoInfo: VideoInfo, isAutoIncluded: boolean): Promise<string[]> {
  const seenLangs = new Set<string>()
  const manualChoices = toChoices(videoInfo.subtitles, '字幕', seenLangs)
  const autoChoices = isAutoIncluded ? toChoices(videoInfo.automatic_captions, '自动', seenLangs) : []
  const choices = [...manualChoices, ...autoChoices]

  if (choices.length === 0) {
    throw new Error(isAutoIncluded ? '该视频没有可用字幕' : '该视频没有人工字幕, 可去掉 --no-auto 以包含自动生成字幕')
  }

  const response = await prompts({
    choices,
    hint: '输入关键字过滤, 空格勾选, 回车确认',
    instructions: false,
    message: '请选择要下载的字幕语言:',
    name: 'langs',
    type: 'autocompleteMultiselect',
  })

  const selectedLangs: string[] | undefined = response.langs
  if (!selectedLangs || selectedLangs.length === 0) {
    throw new Error('未选择字幕，取消下载')
  }

  return selectedLangs
}
