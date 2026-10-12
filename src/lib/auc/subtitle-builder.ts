import type {AlignedWord} from './audiocpp-client.js'

/**
 * 字幕 cue(时间单位: 秒)
 */
export interface SubtitleCue {
  startSeconds: number
  endSeconds: number
  text: string
  // 组成本条 cue 的词级数据(可选; VTT 输出内联词级时间戳标记用)
  words?: AlignedWord[]
}

/**
 * 分段选项
 */
export interface CueSplitOptions {
  // 单条字幕最大字符数(中文字符按 1 计)
  maxChars: number
  // 单条字幕最大时长(秒)
  maxSeconds: number
}

// 强标点: 出现即结束当前 cue
const STRONG_PUNCTUATION = new Set(['；', '!', ',', ';', '！', '?', '？', '.', '。'])
// 弱标点: 当前 cue 已达软上限时才结束
const SOFT_PUNCTUATION = new Set(['，', '、', ':', '：', '……'])

const DEFAULT_CUE_SPLIT_OPTIONS: CueSplitOptions = {maxChars: 18, maxSeconds: 5}

/**
 * 将词级时间戳切分为字幕 cue(分段器):
 * 规则从强到弱 —— 强标点立即收尾; 弱标点达软上限收尾; 字符数/时长硬上限强制收尾。
 */
export function splitWordsIntoCues(words: AlignedWord[], options: CueSplitOptions = DEFAULT_CUE_SPLIT_OPTIONS): SubtitleCue[] {
  const cues: SubtitleCue[] = []
  let currentWords: AlignedWord[] = []

  const flushCurrentCue = (): void => {
    const firstWord = currentWords[0]
    const lastWord = currentWords.at(-1)
    if ((firstWord === undefined) || (lastWord === undefined)) {
      return
    }
    cues.push({
      startSeconds: firstWord.start,
      endSeconds: lastWord.end,
      text: joinCueWords(currentWords),
      words: [...currentWords],
    })
    currentWords = []
  }

  for (const word of words) {
    currentWords.push(word)

    const cueText = joinCueWords(currentWords)
    const cueSeconds = word.end - currentWords[0].start
    // 硬上限: 字符数或时长任一超出即强制收尾
    const isHardLimitReached = (cueText.length >= options.maxChars) || (cueSeconds >= options.maxSeconds)

    if (STRONG_PUNCTUATION.has(word.word)) {
      flushCurrentCue()
      continue
    }
    // 弱标点 + 软上限(硬上限的 2/3)才收尾, 避免碎片化
    const isSoftLimitReached = cueText.length >= Math.floor(options.maxChars * (2 / 3))
    if (SOFT_PUNCTUATION.has(word.word) && isSoftLimitReached) {
      flushCurrentCue()
      continue
    }
    if (isHardLimitReached) {
      flushCurrentCue()
    }
  }

  flushCurrentCue()
  return cues
}

/**
 * cue 文本拼接: 单个 CJK 字符直接相连, 英文单词/多字词之间补空格。
 */
function joinCueWords(words: AlignedWord[]): string {
  let joined = ''
  for (const word of words) {
    joined += cueWordSeparator(joined, word.word) + word.word
  }
  return joined.trim()
}

// 词间分隔符: 非首个词且非 CJK 单字时补空格
function cueWordSeparator(existingText: string, wordText: string): string {
  const isCjkChar = (wordText.length === 1) && (/[\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(wordText))
  return ((existingText !== '') && !isCjkChar && !existingText.endsWith(' ')) ? ' ' : ''
}

// 秒数格式化为 HH:MM:SS,mmm(SRT)或 MM:SS.mmm(VTT, 超一小时自动带小时)
function formatTimestamp(totalSeconds: number, millisecondSeparator: string, shouldShowHour: boolean): string {
  // 时间数字需要取整分段: 时/分向下取整, 毫秒由总秒数与取整部分的差值换算
  const wholeSeconds = Math.floor(totalSeconds)
  const hours = Math.floor(wholeSeconds / 3600)
  const minutes = Math.floor((wholeSeconds % 3600) / 60)
  const seconds = wholeSeconds % 60
  const milliseconds = Math.round((totalSeconds - wholeSeconds) * 1000)

  const paddedMinutes = String(minutes).padStart(2, '0')
  const paddedSeconds = String(seconds).padStart(2, '0')
  const paddedMilliseconds = String(milliseconds).padStart(3, '0')

  if (shouldShowHour) {
    return `${String(hours).padStart(2, '0')}:${paddedMinutes}:${paddedSeconds}${millisecondSeparator}${paddedMilliseconds}`
  }
  return `${paddedMinutes}:${paddedSeconds}${millisecondSeparator}${paddedMilliseconds}`
}

/**
 * 字幕格式化策略接口(策略模式): VTT 与 SRT 仅在时间戳格式与序号上有差异
 */
export interface SubtitleFormatter {
  format(cues: SubtitleCue[]): string
}

/**
 * WebVTT 格式(带词级数据时输出内联时间戳标记, 播放器可据此高亮当前词)
 */
export class VttFormatter implements SubtitleFormatter {
  format(cues: SubtitleCue[]): string {
    const lines = ['WEBVTT', '']
    for (const cue of cues) {
      lines.push(
        `${formatTimestamp(cue.startSeconds, '.', false)} --> ${formatTimestamp(cue.endSeconds, '.', false)}`,
        formatVttPayload(cue),
        '',
      )
    }
    return lines.join('\n')
  }
}

// VTT payload: 带词级数据时输出 <时间戳>词<时间戳>词 内联标记, 否则退回纯文本
function formatVttPayload(cue: SubtitleCue): string {
  if ((cue.words === undefined) || (cue.words.length === 0)) {
    return cue.text
  }

  let payload = ''
  let textOnly = ''
  let previousMark = ''
  for (const word of cue.words) {
    const mark = formatTimestamp(word.start, '.', false)
    // 与前一词落在同一毫秒桶时跳过重复标记, 保持标记单调且精简
    if (mark !== previousMark) {
      payload += `<${mark}>`
      previousMark = mark
    }
    const separator = cueWordSeparator(textOnly, word.word)
    payload += separator + word.word
    textOnly += separator + word.word
  }
  return payload
}

/**
 * SubRip(SRT)格式
 */
export class SrtFormatter implements SubtitleFormatter {
  format(cues: SubtitleCue[]): string {
    const lines: string[] = []
    cues.forEach((cue, cueIndex) => {
      lines.push(
        String(cueIndex + 1),
        `${formatTimestamp(cue.startSeconds, ',', true)} --> ${formatTimestamp(cue.endSeconds, ',', true)}`,
        cue.text,
        '',
      )
    })
    return lines.join('\n')
  }
}

// 格式名 -> 格式化策略注册表
const SUBTITLE_FORMATTERS: Record<string, () => SubtitleFormatter> = {
  vtt: () => new VttFormatter(),
  srt: () => new SrtFormatter(),
}

/**
 * 按格式名构建格式化策略, 未知格式抛错。
 */
export function createSubtitleFormatter(formatName: string): SubtitleFormatter {
  const factory = SUBTITLE_FORMATTERS[formatName]
  if (factory === undefined) {
    throw new Error(`未知字幕格式: ${formatName} (可用: ${Object.keys(SUBTITLE_FORMATTERS).join(', ')})`)
  }
  return factory()
}
