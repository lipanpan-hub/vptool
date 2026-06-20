import {execFileSync} from 'node:child_process'
import {helpers} from 'ytdlp-nodejs'

export interface BinaryStatus {
  found: boolean
  path?: string
  version?: string
}

export interface EnvironmentStatus {
  ready: boolean
  ytdlp: BinaryStatus
  ffmpeg: BinaryStatus
}

function probe(path: string | undefined, args: string[], parse: (out: string) => string): BinaryStatus {
  if (!path) {
    return {found: false}
  }

  try {
    const out = execFileSync(path, args).toString()
    return {found: true, path, version: parse(out)}
  } catch {
    // 二进制存在但执行失败(损坏/权限等), 视为不可用
    return {found: false, path}
  }
}

export function checkEnvironment(): EnvironmentStatus {
  // yt-dlp: 3.4.4 版 getVersionAsync() 有 bug, 直接执行二进制 --version 获取版本
  const ytdlp = probe(helpers.findYtdlpBinary(), ['--version'], (out) => out.trim())

  // ffmpeg: -version 首行形如 "ffmpeg version 6.0 ...", 取第三个 token 作为版本号
  const ffmpeg = probe(helpers.findFFmpegBinary(), ['-version'], (out) => {
    const firstLine = out.split('\n')[0].trim()
    return firstLine.split(/\s+/)[2] ?? firstLine
  })

  return {ffmpeg, ready: ytdlp.found && ffmpeg.found, ytdlp}
}
