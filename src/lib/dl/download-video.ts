import {YtDlp} from 'ytdlp-nodejs'

import {extractAudioToMp3} from './extract-audio.js'

// 组装单行进度文案: 下载进度 | 大小 | 速度 | 预计剩余
function buildProgressLine(progress: {eta_str?: string; percentage_str?: string; speed_str?: string; total_bytes_str?: string}): string {
  const parts = [`下载进度: ${progress.percentage_str}`]

  if (progress.total_bytes_str) {
    parts.push(`大小: ${progress.total_bytes_str}`)
  }

  if (progress.speed_str) {
    parts.push(`速度: ${progress.speed_str}`)
  }

  if (progress.eta_str) {
    parts.push(`预计剩余: ${progress.eta_str}`)
  }

  return parts.join(' | ')
}

// 抽取音频: 对合并后的成品视频单独抽取一份同名 mp3, 避免 bestvideo/bestaudio 分流中间文件被保留
async function extractAudioFromResult(result: any, logger?: {log: (message: string) => void}): Promise<void> {
  const videoPath = result.info?.[0]?.filepath || result.filePaths?.[0]
  if (!videoPath) {
    logger?.log('\n⚠ 未能定位下载的视频文件, 跳过音频抽取')
    return
  }

  logger?.log('\n🎵 正在抽取音频...')
  const mp3Path = await extractAudioToMp3(videoPath, logger)
  logger?.log(`✓ 音频已保存: ${mp3Path}`)
}

export interface DownloadVideoOptions {
  // 随视频一起下载的自动生成字幕语言(如 en-orig), 不需要字幕时省略
  autoSubtitleLang?: string
  // 在下载视频的同时额外抽取一份音频文件(用于语音识别等), 需要 ffmpeg
  extractAudio?: boolean
  formatId: string
  outputDir: string
  useCookies: boolean
}

export async function downloadVideo(
  url: string,
  options: DownloadVideoOptions,
  logger?: {log: (message: string) => void}
): Promise<void> {
  const {autoSubtitleLang, extractAudio, formatId, outputDir, useCookies} = options

  logger?.log(`\n开始下载 (格式ID: ${formatId})...`)
  logger?.log(`保存位置: ${outputDir}\n`)
  if (extractAudio) {
    logger?.log('🎵 将额外抽取一份音频文件\n')
  }

  if (autoSubtitleLang) {
    logger?.log(`📝 将附带下载自动生成字幕 (语言: ${autoSubtitleLang})\n`)
  }

  const ytdlp = new YtDlp()
  
  let lastProgressLength = 0
  
  try {
    // 使用 download builder API
    // 等同命令: yt-dlp -f <formatId> -o "<outputDir>/%(title).35s.%(ext)s" --progress --newline [--cookies-from-browser firefox] <url>
    const builder = ytdlp
      .download(url)
      .addOption('format', formatId)
      .output(`${outputDir}/%(webpage_url_domain)s/%(title)s.%(ext)s`)
      .addArgs('--progress', '--newline')
      .on('progress', (progress: any) => {
        // progress 对象包含: percentage_str, total_bytes_str, speed_str, eta_str 等属性
        if (progress.percentage_str) {
          const progressLine = buildProgressLine(progress)

          if (lastProgressLength > 0) {
            process.stdout.write('\r' + ' '.repeat(lastProgressLength) + '\r')
          }
          process.stdout.write(progressLine)
          lastProgressLength = progressLine.length
        }
      })
      .on('stdout', (data: string) => {
        const output = data.trim()
        if (output.includes('[download]') && !output.includes('%')) {
          if (lastProgressLength > 0) {
            process.stdout.write('\n')
            lastProgressLength = 0
          }
          logger?.log(output)
        }
      })
      .on('stderr', (data: string) => {
        const error = data.trim()
        if (error.length > 0) {
          if (lastProgressLength > 0) {
            process.stdout.write('\n')
            lastProgressLength = 0
          }
          logger?.log(error)
        }
      })
    
    // 自动字幕与视频同目录同名落盘(如 "标题.en-orig.vtt"), 格式优先 vtt
    if (autoSubtitleLang) {
      builder.writeAutoSubs().subLangs([autoSubtitleLang]).addOption('subFormat', 'vtt/best')
    }

    if (useCookies) {
      builder.cookiesFromBrowser('firefox')
    }

    // 下载并合并视频, 合并完成后 yt-dlp 会自动清理 bestvideo/bestaudio 的分流中间文件
    const result = await builder.run()

    if (lastProgressLength > 0) {
      process.stdout.write('\n')
    }

    if (extractAudio) {
      await extractAudioFromResult(result, logger)
    }
  } catch (error) {
    if (lastProgressLength > 0) {
      process.stdout.write('\n')
    }
    throw error
  }
}
