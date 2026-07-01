import {createWriteStream, existsSync, mkdirSync} from 'node:fs'
import {basename, extname, join} from 'node:path'
import {pipeline} from 'node:stream/promises'

import {requestStream} from './http.js'

interface VideoCandidate {
  score: number
  url: string
}

export interface ResolvedDouyinVideo {
  title: string
  url: string
}

const URL_PATTERN = /^https?:\/\//i
const URL_KEY_PATTERN = /(url|play|download|src|uri)/i
const VIDEO_PATH_PATTERN = /(video|play_addr|download_addr|bit_rate|dash|data|aweme_detail)/i
const VIDEO_FILE_URL_PATTERN = /\.(mp4|mov|m4v)(\?|$)/i
const ESCAPED_AMPERSAND = String.raw`\u0026`
const MAX_TITLE_LENGTH = 35
const BRACKETED_TEXT_PATTERN =
  /\([^()]*\)|（[^（）]*）|\[[^\][]*]|［[^［］]*］|\{[^{}]*}|｛[^｛｝]*｝|<[^<>]*>|《[^《》]*》|【[^【】]*】|「[^「」]*」|『[^『』]*』|〔[^〔〕]*〕|〖[^〖〗]*〗|〈[^〈〉]*〉/g

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function sanitizeFilename(value: string): string {
  let sanitized = value
  for (const char of ['<', '>', ':', '"', '/', String.fromCodePoint(92), '|', '?', '*']) {
    sanitized = sanitized.split(char).join('_')
  }

  sanitized = sanitized.replaceAll(/\s+/g, ' ').trim()

  return sanitized.slice(0, 120) || 'douyin-video'
}

function normalizeTitle(value: string): string {
  const title = value
    .replaceAll(/https?:\/\/\S+/gi, '')
    .replaceAll(BRACKETED_TEXT_PATTERN, '')
    .replaceAll(/#[^\s#]+/g, '')
    .replaceAll(/复制此链接.*$/g, '')
    .replaceAll(/打开抖音.*$/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim()

  if (title.length <= MAX_TITLE_LENGTH) return title

  return `${title.slice(0, MAX_TITLE_LENGTH).trimEnd()}`
}

function collectTitle(value: unknown): null | string {
  if (!isRecord(value)) return null
  for (const key of ['desc', 'title', 'item_title', 'share_title']) {
    const title = value[key]
    if (typeof title === 'string' && title.trim()) {
      const normalizedTitle = normalizeTitle(title)
      if (normalizedTitle) return normalizedTitle
    }
  }

  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const title = collectTitle(item)
        if (title) return title
      }
    } else {
      const title = collectTitle(child)
      if (title) return title
    }
  }

  return null
}

function numericScore(record: Record<string, unknown>): number {
  let score = 0
  for (const key of ['bit_rate', 'bitrate', 'data_size', 'size', 'width', 'height']) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      score += value
    }
  }

  return score
}

function collectCandidates(value: unknown, path: string[] = [], contextScore = 0): VideoCandidate[] {
  if (typeof value === 'string') {
    if (!URL_PATTERN.test(value)) return []

    const pathText = path.join('.')
    const url = value.replaceAll(ESCAPED_AMPERSAND, '&')
    let score = contextScore
    if (VIDEO_PATH_PATTERN.test(pathText)) score += 10_000_000
    if (/download/i.test(pathText)) score += 2_000_000
    if (/play/i.test(pathText)) score += 1_000_000
    if (VIDEO_FILE_URL_PATTERN.test(url)) score += 500_000
    if (/watermark/i.test(pathText + url)) score -= 1_000_000
    return [{score, url}]
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectCandidates(item, [...path, String(index)], contextScore))
  }

  if (!isRecord(value)) return []

  const nextContextScore = contextScore + numericScore(value)
  const candidates: VideoCandidate[] = []
  for (const [key, child] of Object.entries(value)) {
    const keyScore = URL_KEY_PATTERN.test(key) || VIDEO_PATH_PATTERN.test(key) ? 1000 : 0
    candidates.push(...collectCandidates(child, [...path, key], nextContextScore + keyScore))
  }

  return candidates
}

export function resolveBestDouyinVideo(data: unknown): ResolvedDouyinVideo {
  const candidates = collectCandidates(data)
    .filter((candidate, index, list) => list.findIndex((item) => item.url === candidate.url) === index)
    .sort((left, right) => right.score - left.score)

  const selected = candidates[0]
  if (!selected) {
    throw new Error('接口响应中未找到可下载的视频地址')
  }

  return {
    title: collectTitle(data) ?? 'douyin-video',
    url: selected.url,
  }
}

function filenameFromResponse(url: string, title: string, contentType: null | string | string[] | undefined): string {
  const urlPath = new URL(url).pathname
  const urlExt = extname(basename(urlPath))
  const contentTypeText = Array.isArray(contentType) ? contentType.join(',') : contentType
  const ext = urlExt || (contentTypeText?.includes('mp4') ? '.mp4' : '.mp4')
  return `${sanitizeFilename(title)}${ext}`
}

export async function downloadResolvedDouyinVideo(
  video: ResolvedDouyinVideo,
  outputDir: string,
  logger?: {log: (message: string) => void},
): Promise<string> {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, {recursive: true})
  }

  const response = await requestStream(video.url)
  if (response.statusCode < 200 || response.statusCode >= 300) {
    response.stream.resume()
    throw new Error(`视频下载失败: HTTP ${response.statusCode} ${response.statusMessage}`)
  }

  const filename = filenameFromResponse(response.url || video.url, video.title, response.headers['content-type'])
  const filepath = join(outputDir, filename)
  logger?.log(`保存位置: ${filepath}`)

  await pipeline(response.stream, createWriteStream(filepath))
  return filepath
}
