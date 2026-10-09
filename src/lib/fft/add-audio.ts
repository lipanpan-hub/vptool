import {spawn} from 'node:child_process'
import {renameSync} from 'node:fs'
import {helpers} from 'ytdlp-nodejs'

// #region 路径计算
// 源视频改名后的存放位置: video.mp4 -> video.old.mp4, 保留原容器扩展名
export function buildBackupPath(videoPath: string): string {
  return videoPath.replace(/(\.[^.]+)$/, '.old$1')
}
// #endregion

// #region 合并
// 先把源视频改名为 .old 备份, 合并结果占用原文件名: 原声轨原样保留, 全部 copy 不重编码, 新音轨排在首位并设为默认
export async function addAudioToVideo(
  videoPath: string,
  audioPath: string,
  logger?: {log: (message: string) => void},
): Promise<string> {
  const ffmpegPath = helpers.findFFmpegBinary()
  if (!ffmpegPath) {
    throw new Error('未找到 ffmpeg, 无法合并音频')
  }

  // #region 源视频改名, 腾出原名给合并结果
  const backupPath = buildBackupPath(videoPath)
  renameSync(videoPath, backupPath)
  // #endregion

  // #region 执行合并
  try {
    await runMerge(ffmpegPath, backupPath, audioPath, videoPath)
  } catch (error) {
    // 合并失败时把源视频改回原名, 避免改名残留
    renameSync(backupPath, videoPath)
    throw error
  }
  // #endregion

  logger?.log(`源视频已备份为: ${backupPath}`)
  logger?.log(`已生成: ${videoPath}`)
  return videoPath
}

// 以备份后的源视频为输入调用 ffmpeg, 输出占用原文件名
function runMerge(
  ffmpegPath: string,
  inputPath: string,
  audioPath: string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      // -v error 只保留真正的错误, 屏蔽 -disposition 重复设置产生的无害警告
      '-v', 'error',
      '-y',
      '-i', inputPath,
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
        resolve()
      } else {
        reject(new Error(`ffmpeg 合并音频失败 (退出码 ${code}): ${stderr.trim()}`))
      }
    })
  })
}
// #endregion