import {YtDlp} from 'ytdlp-nodejs'

export interface UpdateResult {
  method: string
  binaryPath: string
  version?: string
}

export async function updateBinary(): Promise<UpdateResult> {
  // updateYtDlpAsync 会把本地 yt-dlp 升级到最新版本
  const ytdlp = new YtDlp()
  const result = await ytdlp.updateYtDlpAsync()

  return {
    binaryPath: result.binaryPath,
    method: result.method,
    version: result.version ?? undefined,
  }
}
