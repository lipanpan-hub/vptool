import {diffArrays} from 'diff'

interface WordSegment {
  text: string
  time: string
}

const EFFECTIVE = /[\u4e00-\u9fa5A-Za-z0-9]/

function parseWordSegments(vtt: string): WordSegment[] {
  // 提取全部 <时间戳>词 片段,词文本取到下一个标签之前(不跨行)
  const re = /<(\d{2}:\d{2}:\d{2}\.\d{3})>([^<\n]*)/g
  const segments: WordSegment[] = []
  let m: null | RegExpExecArray
  while ((m = re.exec(vtt)) !== null) {
    segments.push({text: m[2], time: m[1]})
  }

  return segments
}

function parseFileEnd(vtt: string): string {
  // 取最后一个时间头的结束时间作为整体结束时间
  const matches = [...vtt.matchAll(/-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/g)]
  return matches.length > 0 ? matches[matches.length - 1][1] : ''
}

function splitParagraphs(text: string): string[] {
  // 按空行分段,去除首尾空白并丢弃空段
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '')
}

function assignWordsToParagraphs(segments: WordSegment[], paragraphs: string[]): WordSegment[][] {
  // 通过字符级 diff 对齐,把每个源词归入对应段落,容忍文本被增删改字

  // #region 构建有效字符流(仅保留汉字/字母/数字)
  const vttChars: string[] = []
  const vttCharWord: number[] = [] // 每个有效字符所属的词索引
  segments.forEach((seg, wi) => {
    for (const c of seg.text) {
      if (EFFECTIVE.test(c)) {
        vttChars.push(c)
        vttCharWord.push(wi)
      }
    }
  })

  const txtChars: string[] = []
  const txtCharPara: number[] = [] // 每个有效字符所属的段落索引
  paragraphs.forEach((p, pi) => {
    for (const c of p) {
      if (EFFECTIVE.test(c)) {
        txtChars.push(c)
        txtCharPara.push(pi)
      }
    }
  })
  // #endregion

  // #region 字符级 diff 对齐,推导每个源词的段落归属
  const changes = diffArrays(vttChars, txtChars)
  const wordPara = new Array<number>(segments.length).fill(-1)
  let vi = 0
  let ti = 0
  let lastPara = 0
  for (const ch of changes) {
    const len = ch.value.length
    if (ch.added) {
      // 仅 demo2 多出的字:只推进文本指针并更新当前段落
      for (let k = 0; k < len; k++, ti++) lastPara = txtCharPara[ti]
    } else if (ch.removed) {
      // 仅源 VTT 多出的字:归入当前段落
      for (let k = 0; k < len; k++, vi++) {
        const wi = vttCharWord[vi]
        if (wordPara[wi] === -1) wordPara[wi] = lastPara
      }
    } else {
      // 公共字符:一一对应
      for (let k = 0; k < len; k++, vi++, ti++) {
        lastPara = txtCharPara[ti]
        const wi = vttCharWord[vi]
        if (wordPara[wi] === -1) wordPara[wi] = lastPara
      }
    }
  }
  // #endregion

  // #region 按段落归属分组,纯标点词(无有效字符)跟随前一个词
  const groups: WordSegment[][] = paragraphs.map(() => [])
  let prevPara = 0
  segments.forEach((seg, wi) => {
    const para = wordPara[wi] === -1 ? prevPara : wordPara[wi]
    groups[para].push(seg)
    prevPara = para
  })
  // #endregion

  return groups
}

export function restampSegments(vttContent: string, segmentedText: string): string {
  const segments = parseWordSegments(vttContent)
  if (segments.length === 0) return 'WEBVTT\n'

  const paragraphs = splitParagraphs(segmentedText)
  const groups = assignWordsToParagraphs(segments, paragraphs)

  // 每段生成一个 cue:start 为段首词时间,end 为下一非空段段首词时间,末段用文件结束时间
  const fileEnd = parseFileEnd(vttContent)
  const cues: string[] = []
  let index = 1
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]
    if (group.length === 0) continue
    const nextGroup = groups.slice(i + 1).find((g) => g.length > 0)
    const end = nextGroup ? nextGroup[0].time : fileEnd
    const payload = group.map((s) => `<${s.time}>${s.text}`).join('')
    cues.push(`${index}\n${group[0].time} --> ${end}\n${payload}`)
    index++
  }

  return `WEBVTT\n\n${cues.join('\n\n')}\n`
}
