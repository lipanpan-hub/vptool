import {YtDlp} from 'ytdlp-nodejs'

export interface DownloadVideoOptions {
  formatId: string
  outputDir: string
  useCookies: boolean
}

export async function downloadVideo(
  url: string, 
  options: DownloadVideoOptions,
  logger?: {log: (message: string) => void}
): Promise<void> {
  const {formatId, outputDir, useCookies} = options
  
  logger?.log(`\n开始下载 (格式ID: ${formatId})...`)
  logger?.log(`保存位置: ${outputDir}\n`)

  const ytdlp = new YtDlp()
  
  let lastProgressLength = 0
  
  try {
    // 使用 download builder API
    // 等同命令: yt-dlp -f <formatId> -o "<outputDir>/%(title)s.%(ext)s" --progress --newline [--cookies-from-browser firefox] <url>
    const builder = ytdlp
      .download(url)
      .addOption('format', formatId)
      .output(`${outputDir}/%(title)s.%(ext)s`)
      .addArgs('--progress', '--newline')
      .on('progress', (progress: any) => {
        // progress 对象包含: percentage_str, total_bytes_str, speed_str, eta_str 等属性
        if (progress.percentage_str) {
          const parts = [
            `下载进度: ${progress.percentage_str}`,
          ]
          
          if (progress.total_bytes_str) {
            parts.push(`大小: ${progress.total_bytes_str}`)
          }
          
          if (progress.speed_str) {
            parts.push(`速度: ${progress.speed_str}`)
          }
          
          if (progress.eta_str) {
            parts.push(`预计剩余: ${progress.eta_str}`)
          }
          
          const progressLine = parts.join(' | ')
          
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
    
    if (useCookies) {
      builder.cookiesFromBrowser('firefox')
    }
    
    await builder.run()
    
    if (lastProgressLength > 0) {
      process.stdout.write('\n')
    }
  } catch (error) {
    if (lastProgressLength > 0) {
      process.stdout.write('\n')
    }
    throw error
  }
}
