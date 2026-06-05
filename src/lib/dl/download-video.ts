import {spawn} from 'node:child_process'

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

  // 构建 yt-dlp 命令参数
  const args = [
    url,
    '--format', formatId,
    '--output', `${outputDir}/%(title)s.%(ext)s`,
    '--progress', // 显示进度
    '--newline',  // 每个进度更新输出一行
  ]

  if (useCookies) {
    args.push('--cookies-from-browser', 'firefox')
  }

  // 使用 spawn 执行 yt-dlp
  return new Promise<void>((resolve, reject) => {
    const child = spawn('yt-dlp', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    
    let lastProgressLength = 0
    
    // 监听标准输出
    child.stdout.on('data', (data: Buffer) => {
      const output = data.toString().trim()
      
      // 匹配 yt-dlp 的进度输出格式
      // 格式示例: [download]  45.8% of 123.45MiB at 1.23MiB/s ETA 00:45
      const progressMatch = output.match(/\[download\]\s+(\d+\.\d+)%\s+of\s+~?\s*(\S+)\s+at\s+(\S+)\s+ETA\s+(\S+)/)
      
      if (progressMatch) {
        const [, percent, size, speed, eta] = progressMatch
        const progressLine = `下载进度: ${percent}% | 大小: ${size} | 速度: ${speed} | 预计剩余: ${eta}`
        
        // 清除上一行并输出新的进度
        if (lastProgressLength > 0) {
          process.stdout.write('\r' + ' '.repeat(lastProgressLength) + '\r')
        }
        process.stdout.write(progressLine)
        lastProgressLength = progressLine.length
      } else if (output.includes('[download]')) {
        // 其他下载相关信息
        if (lastProgressLength > 0) {
          process.stdout.write('\n')
          lastProgressLength = 0
        }
        logger?.log(output)
      } else if (output.length > 0) {
        // 其他信息
        if (lastProgressLength > 0) {
          process.stdout.write('\n')
          lastProgressLength = 0
        }
        logger?.log(output)
      }
    })
    
    // 监听标准错误输出
    child.stderr.on('data', (data: Buffer) => {
      const error = data.toString().trim()
      if (error.length > 0) {
        if (lastProgressLength > 0) {
          process.stdout.write('\n')
          lastProgressLength = 0
        }
        logger?.log(error)
      }
    })
    
    // 监听进程退出
    child.on('close', (code) => {
      if (lastProgressLength > 0) {
        process.stdout.write('\n')
      }
      
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`yt-dlp 进程退出，退出码: ${code}`))
      }
    })
    
    // 监听错误
    child.on('error', (error) => {
      if (lastProgressLength > 0) {
        process.stdout.write('\n')
      }
      reject(error)
    })
  })
}
