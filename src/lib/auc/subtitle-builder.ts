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
 * 将全部词级时间戳合并为单条 cue(不做分段): 时间覆盖首词到末词, 文本为全部词拼接,
 * 并保留词级数据供 VTT 输出内联时间戳标记。
 */
export function buildSingleCue(words: AlignedWord[]): SubtitleCue {
  // 调用方(sub 命令)已保证 words 非空
  const firstWord = words[0]
  const lastWord = words.at(-1) as AlignedWord
  return {
    startSeconds: firstWord.start,
    endSeconds: lastWord.end,
    text: joinCueWords(words),
    words: [...words],
  }
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
