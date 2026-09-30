import {YtDlp} from 'ytdlp-nodejs'

export interface DownloadSubtitleOptions {
  // 是否包含自动生成字幕(同语言同时存在时 yt-dlp 优先下载人工字幕)
  isAutoIncluded: boolean
  langs: string[]
  outputDir: string
  useCookies: boolean
}

// 只下载字幕不下载视频, 返回生成的字幕文件路径
export async function downloadSubtitle(
  url: string,
  options: DownloadSubtitleOptions,
  logger?: {log: (message: string) => void},
): Promise<string[]> {
  const {isAutoIncluded, langs, outputDir, useCookies} = options

  logger?.log(`\n开始下载字幕 (语言: ${langs.join(', ')})...`)
  logger?.log(`保存位置: ${outputDir}\n`)

  const subtitlePaths: string[] = []
  // 等同命令: yt-dlp --skip-download --write-subs [--write-auto-subs] --sub-langs <langs> --sub-format vtt/best -o "<outputDir>/%(title)s.%(ext)s" [--cookies-from-browser firefox] <url>
  const builder = new YtDlp()
    .download(url)
    .skipDownload()
    .writeSubs()
    .subLangs(langs)
    .addOption('subFormat', 'vtt/best')
    .setOutputTemplate(`${outputDir}/%(title)s.%(ext)s`)
    // builder 注入了 --progress-template, stdout 只剩进度 JSON, 因此从 finished 事件中取字幕路径
    .on('progress', (progress: {filename?: string; status?: string}) => {
      if (progress.status === 'finished' && progress.filename && !subtitlePaths.includes(progress.filename)) {
        subtitlePaths.push(progress.filename)
        logger?.log(`✓ 已保存: ${progress.filename}`)
      }
    })
    .on('stderr', (data: string) => {
      const error = data.trim()
      if (error.length > 0) logger?.log(error)
    })

  if (isAutoIncluded) builder.writeAutoSubs()
  if (useCookies) builder.cookiesFromBrowser('firefox')

  await builder.run()
  return subtitlePaths
}
