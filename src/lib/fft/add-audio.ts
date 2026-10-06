import {spawn} from 'node:child_process'
import {helpers} from 'ytdlp-nodejs'

// #region 输出路径计算
export function buildMergedPath(videoPath: string): string {
  // 保留原容器扩展名, 输出到同目录带 .merged 后缀的新文件, 不覆盖源视频
  return videoPath.replace(/(\.[^.]+)$/, '.merged$1')
}
// #endregion

// #region 合并
// 把新音轨加入视频: 原声轨原样保留, 全部 copy 不重编码, 新音轨排在首位并设为默认
export async function addAudioToVideo(
  videoPath: string,
  audioPath: string,
  logger?: {log: (message: string) => void},
): Promise<string> {
  const ffmpegPath = helpers.findFFmpegBinary()
  if (!ffmpegPath) {
    throw new Error('未找到 ffmpeg, 无法合并音频')
  }

  const outputPath = buildMergedPath(videoPath)

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      // -v error 只保留真正的错误, 屏蔽 -disposition 重复设置产生的无害警告
      '-v', 'error',
      '-y',
      '-i', videoPath,
      '-i', audioPath,
      // 新音轨先映射, 成为输出中的第 0 条音轨(排在最前)
      '-map', '1:a:0',
      // 再映射源视频全部流, 原视频/原声轨一条不动地保留
      '-map', '0',
      // 全部直接拷贝, 不重编码
      '-c', 'copy',
      // 先清空所有音轨的默认标记(覆盖原声轨), 再把新音轨单独设为默认
      '-disposition:a', '0',
      '-disposition:a:0', 'default',
      outputPath,
    ])

    let stderr = ''
    proc.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) {
        logger?.log(`已生成: ${outputPath}`)
        resolve(outputPath)
      } else {
        reject(new Error(`ffmpeg 合并音频失败 (退出码 ${code}): ${stderr.trim()}`))
      }
    })
  })
}
// #endregion