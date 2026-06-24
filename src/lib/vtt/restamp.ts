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

interface ParagraphCue {
  firstTime: string
  payload: string
}

function buildParagraphCues(segments: WordSegment[], paragraphs: string[]): (ParagraphCue | null)[] {
  // 以文本文件为基准重建每段文字,在对齐到 VTT 词首的位置插入时间戳,保证文字内容不变

  // #region 构建有效字符流(仅保留汉字/字母/数字)
  const vttChars: string[] = []
  const vttCharTime: string[] = [] // 每个有效字符所属词的时间
  const vttCharFirst: boolean[] = [] // 是否为所属词的首个有效字符
  for (const seg of segments) {
    let first = true
    for (const c of seg.text) {
      if (EFFECTIVE.test(c)) {
        vttChars.push(c)
        vttCharTime.push(seg.time)
        vttCharFirst.push(first)
        first = false
      }
    }
  }

  const txtChars: string[] = []
  const txtCharPara: number[] = [] // 每个有效字符所属的段落索引
  const txtCharLocal: number[] = [] // 每个有效字符在所属段落原文中的下标
  paragraphs.forEach((p, pi) => {
    for (let j = 0; j < p.length; j++) {
      if (EFFECTIVE.test(p[j])) {
        txtChars.push(p[j])
        txtCharPara.push(pi)
        txtCharLocal.push(j)
      }
    }
  })
  // #endregion

  // #region 字符级 diff 对齐,收集每段需要插入的时间戳
  const inserts: {local: number; time: string}[][] = paragraphs.map(() => [])
  const changes = diffArrays(vttChars, txtChars)
  let vi = 0
  let ti = 0
  for (const ch of changes) {
    const len = ch.value.length
    if (ch.added) {
      // 仅文本多出的字:只推进文本指针,这些文字原样保留且不带时间戳
      ti += len
    } else if (ch.removed) {
      // 文本中已删除的源词:无文字锚点,丢弃其时间戳,避免产生无意义的空标签
      vi += len
    } else {
      // 公共字符:一一对应,词首处插入时间戳
      for (let k = 0; k < len; k++, vi++, ti++) {
        if (vttCharFirst[vi]) inserts[txtCharPara[ti]].push({local: txtCharLocal[ti], time: vttCharTime[vi]})
      }
    }
  }
  // #endregion

  // #region 按段落重建原文并插入时间戳
  return paragraphs.map((p, pi) => {
    const list = inserts[pi]
    if (list.length === 0) return null

    const byLocal = new Map<number, string[]>()
    for (const ins of list) {
      const arr = byLocal.get(ins.local)
      if (arr) arr.push(ins.time)
      else byLocal.set(ins.local, [ins.time])
    }

    let payload = ''
    let firstTime = ''
    for (let j = 0; j <= p.length; j++) {
      const times = byLocal.get(j)
      if (times) {
        for (const t of times) {
          if (!firstTime) firstTime = t
          payload += `<${t}>`
        }
      }

      if (j < p.length) payload += p[j]
    }

    return {firstTime, payload}
  })
  // #endregion
}

export function restampSegments(vttContent: string, segmentedText: string): string {
  const segments = parseWordSegments(vttContent)
  if (segments.length === 0) return 'WEBVTT\n'

  const paragraphs = splitParagraphs(segmentedText)
  const built = buildParagraphCues(segments, paragraphs)

  // 每段生成一个 cue:start 为段首时间戳,end 为下一非空段段首时间戳,末段用文件结束时间
  const fileEnd = parseFileEnd(vttContent)
  const cues: string[] = []
  let index = 1
  for (let i = 0; i < built.length; i++) {
    const cur = built[i]
    if (!cur) continue
    const next = built.slice(i + 1).find((b): b is ParagraphCue => b !== null)
    const end = next ? next.firstTime : fileEnd
    cues.push(`${index}\n${cur.firstTime} --> ${end}\n${cur.payload}`)
    index++
  }

  return `WEBVTT\n\n${cues.join('\n\n')}\n`
}
