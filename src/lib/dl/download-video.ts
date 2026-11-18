import {readFile, writeFile} from 'node:fs/promises'
import {basename, dirname, extname, join} from 'node:path'

import {type Download, YtDlp} from 'ytdlp-nodejs'

import {extractAudioToMp3} from './extract-audio.js'
import type {SubtitlePlan} from './select-subtitle.js'

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

// 按字幕计划配置 builder: 人工字幕走 --write-subs, 自动字幕走 --write-auto-subs, 两者共用 --sub-langs
// 字幕与视频同目录同名落盘(如 "标题.en-orig.vtt"、"标题.ai-zh.srt"), 格式优先 vtt, 没有 vtt 时取站点最优格式
function applySubtitlePlan(builder: Download, subtitlePlan: SubtitlePlan): void {
  const allLangs = [...subtitlePlan.manualLangs, ...subtitlePlan.autoLangs]
  if (allLangs.length === 0) return

  if (subtitlePlan.manualLangs.length > 0) builder.writeSubs()
  if (subtitlePlan.autoLangs.length > 0) builder.writeAutoSubs()
  builder.subLangs(allLangs).addOption('subFormat', 'vtt/best')
  // 字幕下载失败(如机翻 zh-Hans 遇 HTTP 429)默认会中止整个下载; --ignore-errors 将其降级为 WARNING 继续下载视频
  // 视频本身下载失败时 yt-dlp 仍以非零退出码结束, 不会被吞掉
  builder.addOption('ignoreErrors', true)
}

// 下载开始前输出本次下载计划: 格式、保存位置及附带产物
function logDownloadPlan(options: DownloadVideoOptions, logger?: {log: (message: string) => void}): void {
  if (!logger) return
  const {extractAudio, formatId, outputDir, subtitlePlan, writeDescription, writeThumbnail} = options
  const subtitleLangs = [...subtitlePlan.manualLangs, ...subtitlePlan.autoLangs]

  logger.log(`\n开始下载 (格式ID: ${formatId})...`)
  logger.log(`保存位置: ${outputDir}\n`)
  if (extractAudio) logger.log('🎵 将额外抽取一份音频文件\n')
  if (subtitleLangs.length > 0) logger.log(`📝 将附带下载字幕 (语言: ${subtitleLangs.join(', ')})\n`)
  if (writeDescription) logger.log('📄 将附带下载视频简介\n')
  if (writeThumbnail) logger.log('🖼️ 将附带下载视频封面\n')
}

export interface DownloadVideoOptions {
  // 随视频一起下载的字幕计划, 不需要字幕时两个列表都传空数组
  subtitlePlan: SubtitlePlan
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
  const {extractAudio, formatId, outputDir, subtitlePlan, useCookies, writeDescription, writeThumbnail} = options

  logDownloadPlan(options, logger)

  const ytdlp = new YtDlp()
  
  let lastProgressLength = 0
  
  try {
    // 使用 download builder API
    // 等同命令: yt-dlp -f <formatId> -o "<outputDir>/<域名>/<频道名>/<标题前15字符>/<标题前120字符>.<扩展名>" --replace-in-metadata title,channel,uploader "<零宽字符正则>" "" --progress --newline [--cookies-from-browser firefox] <url>
    // 注意: ytdlp-nodejs 的 .output() 是目录语义(内部自动追加 /%(title)s.%(ext)s), 自定义文件名模板必须用 .setOutputTemplate()
    // 频道名优先取 channel, 缺失时回退 uploader(如 B 站), 避免出现 NA 文件夹
    // 每个视频放在标题缩写文件夹内, 字幕/mp3/简介跟随视频文件名落在其中
    // 文件夹名的标题截断为 15 字符以压缩路径长度(Windows MAX_PATH 为 259 字符), 文件名的标题宽松截断为 120 字符, 频道名不截断
    // 零宽字符(U+200B-U+200F, U+2060, U+FEFF)在生成文件名前从元数据中剔除(替换先于截断); FIELDS 必须用逗号分隔, 用 | 不生效
    const builder = ytdlp
      .download(url)
      .addOption('format', formatId)
      .setOutputTemplate(`${outputDir}/%(webpage_url_domain)s/%(channel,uploader)s/%(title).15s/%(title).120s.%(ext)s`)
      .addArgs('--replace-in-metadata', 'title,channel,uploader', String.raw`[\u200b-\u200f\u2060\ufeff]`, '')
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
    
    applySubtitlePlan(builder, subtitlePlan)

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

    // 返回视频所在目录(即 <标题前15字符> 文件夹, 字幕/mp3/简介等附带产物都在其中)
    return videoPath ? dirname(videoPath) : undefined
  } catch (error) {
    if (lastProgressLength > 0) {
      process.stdout.write('\n')
    }
    throw error
  }
}
