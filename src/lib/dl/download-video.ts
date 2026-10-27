import {readFile, writeFile} from 'node:fs/promises'
import {basename, dirname, extname, join} from 'node:path'

import {YtDlp} from 'ytdlp-nodejs'

import {extractAudioToMp3} from './extract-audio.js'

// 从下载结果中定位成品视频文件路径(分流/合并完成后 yt-dlp 回报的最终文件)
function resolveVideoPath(result: any): string | undefined {
  return result.info?.[0]?.filepath || result.filePaths?.[0]
}

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

// 在简介文件首行插入"频道名|视频URL"(便于后期按分隔符解析溯源, 重复下载时首行始终只保留一行, 不累积)
async function prependUrlToDescription(videoPath: string, videoUrl: string, channelName: string | undefined, logger?: {log: (message: string) => void}): Promise<void> {
  const videoName = basename(videoPath, extname(videoPath))
  const descriptionPath = join(dirname(videoPath), `${videoName}.description`)

  try {
    const originalContent = await readFile(descriptionPath, 'utf8')
    // 首行已包含相同链接时先移除, 避免重复下载累积多行 URL
    const contentLines = originalContent.split('\n')
    if (contentLines[0]?.includes(videoUrl)) {
      contentLines.shift()
    }
    // 频道名缺失时首行退化为纯 URL
    const sourceLine = channelName ? `${channelName}|${videoUrl}` : videoUrl
    await writeFile(descriptionPath, `${sourceLine}\n${contentLines.join('\n')}`, 'utf8')
    logger?.log('✓ 简介文件首行已写入视频链接')
  } catch {
    logger?.log('⚠ 未找到简介文件, 跳过写入视频链接')
  }
}

// 抽取音频: 对合并后的成品视频单独抽取一份同名 mp3, 避免 bestvideo/bestaudio 分流中间文件被保留
async function extractAudioFromResult(result: any, logger?: {log: (message: string) => void}): Promise<void> {
  const videoPath = resolveVideoPath(result)
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
  // 随视频一起下载简介(.description 文件, 与视频同名), 不需要时省略
  writeDescription?: boolean
  // 随视频一起下载封面图(转为 jpg, 与视频同名), 不需要时省略
  writeThumbnail?: boolean
}

export async function downloadVideo(
  url: string,
  options: DownloadVideoOptions,
  logger?: {log: (message: string) => void}
): Promise<string | undefined> {
  const {autoSubtitleLang, extractAudio, formatId, outputDir, useCookies, writeDescription, writeThumbnail} = options

  logger?.log(`\n开始下载 (格式ID: ${formatId})...`)
  logger?.log(`保存位置: ${outputDir}\n`)
  if (extractAudio) {
    logger?.log('🎵 将额外抽取一份音频文件\n')
  }

  if (autoSubtitleLang) {
    logger?.log(`📝 将附带下载自动生成字幕 (语言: ${autoSubtitleLang})\n`)
  }

  if (writeDescription) {
    logger?.log(`📄 将附带下载视频简介\n`)
  }

  if (writeThumbnail) {
    logger?.log(`🖼️ 将附带下载视频封面\n`)
  }

  const ytdlp = new YtDlp()
  
  let lastProgressLength = 0
  
  try {
    // 使用 download builder API
    // 等同命令: yt-dlp -f <formatId> -o "<outputDir>/<域名>/<频道名>/<标题>.<扩展名>/<标题>.<扩展名>" --progress --newline [--cookies-from-browser firefox] <url>
    // 注意: ytdlp-nodejs 的 .output() 是目录语义(内部自动追加 /%(title)s.%(ext)s), 自定义文件名模板必须用 .setOutputTemplate()
    // 频道名优先取 channel, 缺失时回退 uploader(如 B 站), 避免出现 NA 文件夹
    // 每个视频放在 <标题>.<扩展名> 同名文件夹内(需求: 文件夹装同名视频), 字幕/mp3/简介跟随落在其中
    const builder = ytdlp
      .download(url)
      .addOption('format', formatId)
      .setOutputTemplate(`${outputDir}/%(webpage_url_domain)s/%(channel,uploader)s/%(title)s.%(ext)s/%(title)s.%(ext)s`)
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

    // 视频简介与视频同目录同名落盘(如 "标题.description")
    if (writeDescription) {
      builder.addOption('writeDescription', true)
    }

    // 封面与视频同目录同名落盘, YouTube 原始为 webp, 借助 ffmpeg 统一转为 jpg 提高兼容性
    if (writeThumbnail) {
      builder.writeThumbnail().addOption('convertThumbnails', 'jpg')
    }

    if (useCookies) {
      builder.cookiesFromBrowser('firefox')
    }

    // 下载并合并视频, 合并完成后 yt-dlp 会自动清理 bestvideo/bestaudio 的分流中间文件
    const result = await builder.run()

    if (lastProgressLength > 0) {
      process.stdout.write('\n')
    }

    // 定位成品视频文件路径(分流/合并完成后 yt-dlp 回报的最终文件)
    const videoPath = resolveVideoPath(result)

    if (extractAudio) {
      await extractAudioFromResult(result, logger)
    }

    // 简介文件首行插入"频道名|视频链接", 便于溯源
    if (writeDescription && videoPath) {
      // 频道名优先取 channel, 缺失时回退 uploader(如 B 站), 与输出模板的回退逻辑一致
      const channelName: string | undefined = result.info?.[0]?.channel || result.info?.[0]?.uploader
      await prependUrlToDescription(videoPath, url, channelName, logger)
    }

    // 返回视频所在目录(即 <标题>.<扩展名> 同名文件夹, 字幕/mp3/简介等附带产物都在其中)
    return videoPath ? dirname(videoPath) : undefined
  } catch (error) {
    if (lastProgressLength > 0) {
      process.stdout.write('\n')
    }
    throw error
  }
}
