import {spawn} from 'node:child_process'
import {renameSync} from 'node:fs'
import {helpers} from 'ytdlp-nodejs'

// #region 路径计算
// 源视频改名后的存放位置: video.mp4 -> video.old.mp4, 保留原容器扩展名
export function buildBackupPath(videoPath: string): string {
  return videoPath.replace(/(\.[^.]+)$/, '.old$1')
}

// buildBackupPath 的逆操作: 文件名带 .old. 段时视为备份文件, 还原为不带 old 的名字: video.old.mp4 -> video.mp4
export function buildOriginalPath(videoPath: string): string {
  return videoPath.replace(/\.old(\.[^.]+)$/, '$1')
}
// #endregion

// #region 合并
// 源名不带 .old. 时: 先把源视频改名为 .old 备份, 合并结果占用原文件名
// 源名带 .old. 时: 视源视频为备份文件, 不再改名, 合并结果直接占用去 old 后的名字
// 原声轨原样保留, 全部 copy 不重编码, 新音轨排在首位并设为默认
export async function addAudioToVideo(
  videoPath: string,
  audioPath: string,
  logger?: {log: (message: string) => void},
): Promise<string> {
  const ffmpegPath = helpers.findFFmpegBinary()
  if (!ffmpegPath) {
    throw new Error('未找到 ffmpeg, 无法合并音频')
  }

  // #region 计算路径: 结果占用原名时才走改名备份流程
  const outputPath = buildOriginalPath(videoPath)
  const isBackupMode = (outputPath === videoPath)
  const mergeInputPath = isBackupMode ? buildBackupPath(videoPath) : videoPath
  // #endregion

  // #region 备份模式下把源视频改名为 .old, 腾出原名给合并结果
  if (isBackupMode) renameSync(videoPath, mergeInputPath)
  // #endregion

  // #region 执行合并
  try {
    await runMerge(ffmpegPath, mergeInputPath, audioPath, outputPath)
  } catch (error) {
    // 备份模式合并失败时把源视频改回原名, 避免改名残留
    if (isBackupMode) renameSync(mergeInputPath, videoPath)
    throw error
  }
  // #endregion

  if (isBackupMode) logger?.log(`源视频已备份为: ${mergeInputPath}`)
  logger?.log(`已生成: ${outputPath}`)
  return outputPath
}

// 以源视频(或其备份)为输入调用 ffmpeg, 输出到合并结果路径
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