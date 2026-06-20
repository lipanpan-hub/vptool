interface WordSegment {
  text: string
  time: string
}

const EFFECTIVE = /[\u4e00-\u9fa5A-Za-z0-9]/

function parseWordSegments(vtt: string): WordSegment[] {
  // 提取全部 <时间戳>词 片段,词文本取到下一个标签之前
  const re = /<(\d{2}:\d{2}:\d{2}\.\d{3})>([^<]*)/g
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

function countEffective(s: string): number {
  // 统计有效字符数(汉字/字母/数字),忽略标点与空白
  let n = 0
  for (const c of s) if (EFFECTIVE.test(c)) n++
  return n
}

function splitParagraphs(text: string): string[] {
  // 按空行分段,去除首尾空白并丢弃空段
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '')
}

export function restampSegments(vttContent: string, segmentedText: string): string {
  const segments = parseWordSegments(vttContent)
  if (segments.length === 0) return 'WEBVTT\n'

  // 计算每个段落在全局有效字符流中的结束边界
  const paragraphs = splitParagraphs(segmentedText)
  const paraBoundaries: number[] = []
  let acc = 0
  for (const p of paragraphs) {
    acc += countEffective(p)
    paraBoundaries.push(acc)
  }

  // 按每个词首字符的全局位置,将词归入对应段落
  const groups: WordSegment[][] = paragraphs.map(() => [])
  let charPos = 0
  let pIdx = 0
  for (const seg of segments) {
    while (pIdx < paraBoundaries.length - 1 && charPos >= paraBoundaries[pIdx]) pIdx++
    groups[pIdx].push(seg)
    charPos += countEffective(seg.text)
  }

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
