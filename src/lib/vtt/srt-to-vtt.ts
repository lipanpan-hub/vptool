interface Cue {
  end: string
  payload: string
  start: string
}

// SRT 时间戳形如 00:00:01,660, VTT 要求毫秒分隔符为句点
function srtTimestampToVtt(timestamp: string): string {
  return timestamp.trim().replaceAll(',', '.')
}

function parseCue(block: string): Cue | null {
  const lines = block.split('\n')
  const tsIndex = lines.findIndex((l) => l.includes('-->'))
  if (tsIndex === -1) return null

  // 时间戳行左侧为起始时间, 右侧丢弃可能存在的坐标等排版设置只取结束时间; 序号行在时间戳行之前, 自然被忽略
  const [startPart, rest] = lines[tsIndex].split('-->')
  const start = srtTimestampToVtt(startPart)
  const end = srtTimestampToVtt(rest.trim().split(/\s+/)[0])

  const payload = lines.slice(tsIndex + 1).join('\n').trim()
  return {end, payload, start}
}

function parseCues(content: string): Cue[] {
  // 统一行尾后按空行切块, 收集全部 cue
  const blocks = content.replaceAll('\r\n', '\n').split(/\n[ \t]*\n/)
  return blocks.map((block) => parseCue(block)).filter((cue): cue is Cue => cue !== null)
}

function cuesToBody(cues: Cue[]): string {
  return cues.map((cue) => `${cue.start} --> ${cue.end}\n${cue.payload}`).join('\n\n')
}

export function srtToVtt(content: string): string {
  const body = cuesToBody(parseCues(content))
  if (body === '') return 'WEBVTT\n'

  return `WEBVTT\n\n${body}\n`
}

export function srtToSingleCueVtt(content: string): string {
  const cues = parseCues(content)
  if (cues.length === 0) return 'WEBVTT\n'

  // 合并为单条字幕: 首 cue 起始时间到末 cue 结束时间; 每条原 cue 文本前内嵌其起始时间戳, 尽可能保留原始时间信息
  const start = cues[0].start
  const end = cues.at(-1)!.end
  const payload = cues.map((cue) => `<${cue.start}>${cue.payload}`).join('')

  return `WEBVTT\n\n${start} --> ${end}\n${payload}\n`
}
