interface Cue {
  end: string
  payload: string
  start: string
}

function stripVoiceTags(text: string): string {
  // 仅移除 <v 说话人> 与 </v> 标签,保留 <时间戳> 等其他标签
  return text.replace(/<\/?v(?:\s[^>]*)?>/gi, '')
}

function isMetaBlock(lines: string[]): boolean {
  // WEBVTT 头部及 NOTE/STYLE/REGION 块不是字幕 cue,需跳过
  const first = lines.find((l) => l.trim() !== '')?.trim() ?? ''
  return first.startsWith('WEBVTT') || /^(NOTE|REGION|STYLE)\b/.test(first)
}

function parseCue(block: string): Cue | null {
  const lines = block.split('\n')
  const tsIndex = lines.findIndex((l) => l.includes('-->'))
  if (tsIndex === -1 || isMetaBlock(lines)) return null

  // 解析时间戳行,丢弃 -->后可能存在的排版设置,只取起止时间
  const [startPart, rest] = lines[tsIndex].split('-->')
  const start = startPart.trim()
  const end = rest.trim().split(/\s+/)[0]

  // payload 多行合并并去除说话人
  const payload = stripVoiceTags(lines.slice(tsIndex + 1).join(''))
  return {end, payload, start}
}

function parseCues(content: string): Cue[] {
  // 统一行尾后按空行切块,收集全部 cue
  const blocks = content.replace(/\r\n/g, '\n').split(/\n[ \t]*\n/)
  return blocks.map((block) => parseCue(block)).filter((cue): cue is Cue => cue !== null)
}

export function extractText(content: string): string {
  // 提取纯文本:去除时间戳等残余标签,每条字幕占一行
  const cues = parseCues(content)
  return cues.map((cue) => cue.payload.replace(/<[^>]*>/g, '').trim()).join('\n') + '\n'
}

export function zipVtt(content: string): string {
  const cues = parseCues(content)
  if (cues.length === 0) return 'WEBVTT\n'

  // 合并为单条字幕:首 cue 起始时间到末 cue 结束时间,拼接全部内容到一行
  const start = cues[0].start
  const end = cues[cues.length - 1].end
  const payload = cues.map((cue) => cue.payload).join('')

  return `WEBVTT\n\n${start} --> ${end}\n${payload}\n`
}
