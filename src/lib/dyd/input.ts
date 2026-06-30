export interface DouyinInput {
  awemeId: null | string
  original: string
  shareUrl: null | string
}

const URL_PATTERN = /https?:\/\/[^\s"'<>，。]+/i
const AWEME_ID_PATTERNS = [
  /(?:aweme_id|modal_id|item_ids)=([0-9]+)/i,
  /\/(?:video|note)\/([0-9]+)/i,
  /\/share\/(?:video|note)\/([0-9]+)/i,
  /\b([0-9]{12,})\b/,
]

export function parseDouyinInput(input: string): DouyinInput {
  const trimmed = input.trim()
  const url = trimmed.match(URL_PATTERN)?.[0] ?? null
  const source = url ?? trimmed
  const awemeId = AWEME_ID_PATTERNS
    .map((pattern) => source.match(pattern)?.[1])
    .find(Boolean) ?? null

  return {
    awemeId,
    original: trimmed,
    shareUrl: url,
  }
}
