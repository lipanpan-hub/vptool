import Table from 'cli-table3'
import type {VideoInfo} from 'ytdlp-nodejs'

export interface DisplayLogger {
  log(message: string): void
}

// 打印基本信息
export function displayBasicInfo(videoInfo: VideoInfo, logger: DisplayLogger): void {
  logger.log('\n' + '═'.repeat(60))
  logger.log('📹 基本信息')
  logger.log('═'.repeat(60))
  if (videoInfo.title) logger.log(`标题: ${videoInfo.title}`)
  if (videoInfo.uploader) logger.log(`上传者: ${videoInfo.uploader}`)
  if (videoInfo.uploader_id) logger.log(`上传者ID: ${videoInfo.uploader_id}`)
  if (videoInfo.channel) logger.log(`频道: ${videoInfo.channel}`)
  if (videoInfo.channel_id) logger.log(`频道ID: ${videoInfo.channel_id}`)
  if (videoInfo.upload_date) logger.log(`上传日期: ${videoInfo.upload_date}`)
  if (videoInfo.description) {
    const shortDesc = videoInfo.description.slice(0, 200)
    logger.log(`简介: ${shortDesc}${videoInfo.description.length > 200 ? '...' : ''}`)
  }
}

// 打印视频属性
export function displayVideoProperties(videoInfo: VideoInfo, logger: DisplayLogger): void {
  logger.log('\n' + '═'.repeat(60))
  logger.log('🎬 视频属性')
  logger.log('═'.repeat(60))
  if (videoInfo.duration) {
    const minutes = Math.floor(videoInfo.duration / 60)
    const seconds = videoInfo.duration % 60
    logger.log(`时长: ${minutes}:${seconds.toString().padStart(2, '0')} (${videoInfo.duration}秒)`)
  }
  if (videoInfo.width && videoInfo.height) {
    logger.log(`分辨率: ${videoInfo.width}x${videoInfo.height}`)
  }
  if (videoInfo.fps) logger.log(`帧率: ${videoInfo.fps} fps`)
  if (videoInfo.vcodec) logger.log(`视频编码: ${videoInfo.vcodec}`)
  if (videoInfo.acodec) logger.log(`音频编码: ${videoInfo.acodec}`)
  if (videoInfo.filesize || videoInfo.filesize_approx) {
    const size = videoInfo.filesize || videoInfo.filesize_approx || 0
    const sizeMB = (size / 1024 / 1024).toFixed(2)
    logger.log(`文件大小: ${sizeMB} MB`)
  }
  if (videoInfo.ext) logger.log(`格式: ${videoInfo.ext}`)
}

// 打印统计信息
export function displayStatistics(videoInfo: VideoInfo, logger: DisplayLogger): void {
  logger.log('\n' + '═'.repeat(60))
  logger.log('📊 统计信息')
  logger.log('═'.repeat(60))
  if (videoInfo.view_count !== undefined) {
    logger.log(`观看次数: ${videoInfo.view_count.toLocaleString()}`)
  }
  if (videoInfo.like_count !== undefined) {
    logger.log(`点赞数: ${videoInfo.like_count.toLocaleString()}`)
  }
  if (videoInfo.comment_count !== undefined) {
    logger.log(`评论数: ${videoInfo.comment_count.toLocaleString()}`)
  }
}

// 打印其他信息
export function displayOtherInfo(videoInfo: VideoInfo, logger: DisplayLogger): void {
  logger.log('\n' + '═'.repeat(60))
  logger.log('🔗 其他信息')
  logger.log('═'.repeat(60))
  if (videoInfo.webpage_url) logger.log(`网页链接: ${videoInfo.webpage_url}`)
  if (videoInfo.id) logger.log(`视频ID: ${videoInfo.id}`)
  if (videoInfo.extractor) logger.log(`来源平台: ${videoInfo.extractor}`)
  if (videoInfo.thumbnail) logger.log(`缩略图: ${videoInfo.thumbnail}`)
  if (videoInfo.categories && videoInfo.categories.length > 0) {
    logger.log(`分类: ${videoInfo.categories.join(', ')}`)
  }
  if (videoInfo.tags && videoInfo.tags.length > 0) {
    const tags = videoInfo.tags.slice(0, 10).join(', ')
    logger.log(`标签: ${tags}${videoInfo.tags.length > 10 ? '...' : ''}`)
  }
}

// 打印可用格式
export function displayFormats(videoInfo: VideoInfo, logger: DisplayLogger): void {
  if (!videoInfo.formats || videoInfo.formats.length === 0) return

  logger.log('\n' + '═'.repeat(60))
  logger.log('📦 可用格式')
  logger.log('═'.repeat(60))
  logger.log(`总计 ${videoInfo.formats.length} 个格式\n`)

  const table = new Table({
    colWidths: [6, 10, 10, 15, 12, 30],
    head: ['序号', 'ID', '扩展名', '分辨率', '大小(MB)', '备注'],
  })

  for (const [index, format] of videoInfo.formats.entries()) {
    const size = format.filesize ? (format.filesize / 1024 / 1024).toFixed(2) : '-'

    table.push([
      (index + 1).toString(),
      format.format_id || '-',
      format.ext || '-',
      format.resolution || '-',
      size,
      format.format_note || '-',
    ])
  }

  logger.log(table.toString())
}

// 打印字幕信息
export function displaySubtitles(videoInfo: VideoInfo, logger: DisplayLogger): void {
  logger.log('\n' + '═'.repeat(60))
  logger.log('💬 字幕信息')
  logger.log('═'.repeat(60))

  const hasSubtitles = videoInfo.subtitles && Object.keys(videoInfo.subtitles).length > 0
  const hasCaptions = videoInfo.automatic_captions && Object.keys(videoInfo.automatic_captions).length > 0

  if (!hasSubtitles && !hasCaptions) {
    logger.log('该视频没有可用字幕')
    return
  }

  // #region 手动字幕
  if (hasSubtitles) {
    logger.log('\n📝 手动字幕:')
    const subtitlesTable = new Table({
      colWidths: [15, 20, 15],
      head: ['语言代码', '格式', '扩展名'],
    })

    for (const [langCode, subtitleList] of Object.entries(videoInfo.subtitles)) {
      const formats = subtitleList.map((s: any) => s.ext).filter(Boolean).join(', ')
      const names = subtitleList.map((s: any) => s.name).filter(Boolean)[0] || langCode

      subtitlesTable.push([
        langCode,
        names,
        formats || '-',
      ])
    }

    logger.log(subtitlesTable.toString())
    logger.log(`共 ${Object.keys(videoInfo.subtitles).length} 种语言`)
  }
  // #endregion

  // #region 自动生成字幕
  if (hasCaptions) {
    logger.log('\n🤖 自动生成字幕:')
    const captionsTable = new Table({
      colWidths: [15, 20, 15],
      head: ['语言代码', '格式', '扩展名'],
    })

    for (const [langCode, captionList] of Object.entries(videoInfo.automatic_captions)) {
      const formats = captionList.map((c: any) => c.ext).filter(Boolean).join(', ')
      const names = captionList.map((c: any) => c.name).filter(Boolean)[0] || langCode

      captionsTable.push([
        langCode,
        names,
        formats || '-',
      ])
    }

    logger.log(captionsTable.toString())
    logger.log(`共 ${Object.keys(videoInfo.automatic_captions).length} 种语言`)
  }
  // #endregion
}

// 打印完整的视频信息
export function displayVideoInfo(videoInfo: VideoInfo, logger: DisplayLogger): void {
  displayBasicInfo(videoInfo, logger)
  displayVideoProperties(videoInfo, logger)
  displayStatistics(videoInfo, logger)
  displayOtherInfo(videoInfo, logger)
  displayFormats(videoInfo, logger)
  displaySubtitles(videoInfo, logger)
  
  logger.log('\n' + '═'.repeat(60))
  logger.log('✅ 元信息获取完成')
  logger.log('═'.repeat(60))
}
