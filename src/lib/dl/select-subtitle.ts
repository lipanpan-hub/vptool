import prompts from 'prompts'
import type {VideoInfo} from 'ytdlp-nodejs'

interface SubtitleChoice {
  description: string
  title: string
  value: string
}

type SubtitleMap = Record<string, {ext: string; name: string; url: string}[]> | undefined

// 自动英文字幕语言优先级: en-orig 是 YouTube 的 "English (Original)" 原声 ASR 轨, 缺失时回退 en
const AUTO_EN_SUBTITLE_LANG_PRIORITY = ['en-orig', 'en']

// 按优先级挑出视频可用的自动英文字幕语言, 都没有时返回 undefined
export function resolveAutoEnglishSubtitleLang(videoInfo: VideoInfo): string | undefined {
  const autoCaptions = videoInfo.automatic_captions ?? {}
  return AUTO_EN_SUBTITLE_LANG_PRIORITY.find((lang) => autoCaptions[lang])
}

// 自动简体中文字幕语言: zh-Hans 是 YouTube 从原声 ASR 轨机翻的 "Chinese (Simplified)"
const AUTO_ZH_SUBTITLE_LANG = 'zh-Hans'

// 汇总随视频附带下载的自动字幕语言: 英文(按优先级挑一个) + 简体中文, 视频缺失的语言自动跳过
export function resolveAutoSubtitleLangs(videoInfo: VideoInfo): string[] {
  const autoCaptions = videoInfo.automatic_captions ?? {}
  const englishLang = resolveAutoEnglishSubtitleLang(videoInfo)
  const chineseLang = autoCaptions[AUTO_ZH_SUBTITLE_LANG] ? AUTO_ZH_SUBTITLE_LANG : undefined
  return [englishLang, chineseLang].filter((lang): lang is string => lang !== undefined)
}

// 随视频附带下载的字幕计划: manualLangs 走 --write-subs, autoLangs 走 --write-auto-subs
export interface SubtitlePlan {
  autoLangs: string[]
  manualLangs: string[]
}

// B 站 AI 中文字幕语言, 属于普通字幕(subtitles)而非自动字幕
const BILIBILI_AI_ZH_SUBTITLE_LANG = 'ai-zh'

// 各站点的字幕计划策略, 按 yt-dlp 的 extractor_key 索引
// B 站字幕信息只在请求写字幕时才会提取(-J 拿不到), 无法预先判断是否存在, 因此直接请求; 缺失时 yt-dlp 仅提示不报错
const SUBTITLE_PLAN_RESOLVERS: Record<string, (videoInfo: VideoInfo) => SubtitlePlan> = {
  BiliBili: () => ({autoLangs: [], manualLangs: [BILIBILI_AI_ZH_SUBTITLE_LANG]}),
  Youtube: (videoInfo) => ({autoLangs: resolveAutoSubtitleLangs(videoInfo), manualLangs: []}),
}

// 按站点解析随视频附带下载的字幕计划, 未配置的站点不附带字幕
export function resolveSubtitlePlan(videoInfo: VideoInfo): SubtitlePlan {
  const resolvePlan = SUBTITLE_PLAN_RESOLVERS[videoInfo.extractor_key]
  return resolvePlan ? resolvePlan(videoInfo) : {autoLangs: [], manualLangs: []}
}

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
