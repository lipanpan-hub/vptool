import {spawn} from 'node:child_process'
import {existsSync, renameSync, rmSync} from 'node:fs'
import {extname} from 'node:path'
import {helpers} from 'ytdlp-nodejs'

import {burnSubtitle, buildBurnedPath, SubtitleInput, SubtitleStyle} from './burn-subtitle.js'
import {readAudioCodec} from './probe.js'

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

// #region 中英字幕样式
// ffmpeg 的 subtitles 滤镜把 vtt 转成 PlayResY=288 的 ass, FontSize/MarginV 都是相对该基准的值, libass 渲染时按视频实际高度等比缩放
// (默认字号 16): 中文适度加大保持主体地位, 英文缩小仅作对照
const ZH_SUBTITLE_FONT_SIZE = 12
const EN_SUBTITLE_FONT_SIZE = 8
// 英文对照字幕半透明显示, 降低对画面的干扰
const EN_SUBTITLE_OPACITY = 0.3
// 中文字幕底部距画面底边的距离: 抬高到英文字幕上方, 与英文错开不重叠
const ZH_SUBTITLE_MARGIN_V = 15
// 英文字幕底部距画面底边的距离: 底部常规位置(与 ffmpeg 缺省值一致)
const EN_SUBTITLE_MARGIN_V = 5

// 中文字幕: 底部居中(默认对齐 2), 大字号, 抬高到英文上方
const ZH_SUBTITLE_STYLE: SubtitleStyle = {fontSize: ZH_SUBTITLE_FONT_SIZE, marginV: ZH_SUBTITLE_MARGIN_V}

// 英文字幕: 底部居中常规位置(默认对齐), 小字号半透明, 仅为中文观众提供对照; WrapStyle=2 永远单行显示不自动换行
const EN_SUBTITLE_STYLE: SubtitleStyle = {
  fontColor: '#FFFFFF',
  fontOpacity: EN_SUBTITLE_OPACITY,
  fontSize: EN_SUBTITLE_FONT_SIZE,
  marginV: EN_SUBTITLE_MARGIN_V,
  outlineColor: '#000000',
  wrapStyle: 2,
}
// #endregion

// #region 类型定义
export interface AddAudioOptions {
  // 烧写字幕时进度行写入的流, 默认 stdout; 传 null 禁用进度(--json 模式)
  progressStream?: NodeJS.WriteStream | null
  // 要烧写的中文字幕: 底部居中且抬高到英文上方, 大字号
  subtitleZhPath?: string
  // 要烧写的英文字幕: 底部常规位置, 小字号半透明, 仅作对照, 永远单行显示
  subtitleEnPath?: string
}
// #endregion

// #region 合并
// 源名不带 .old. 时: 先把源视频改名为 .old 备份, 合并结果占用原文件名
// 源名带 .old. 时: 视源视频为备份文件, 不再改名, 合并结果直接占用去 old 后的名字
// 原声轨原样保留, 全部 copy 不重编码, 新音轨排在首位并设为默认
// 传入 subtitleZhPath/subtitleEnPath 时合并后按各自样式烧写(视频重编码), 两者都缺省则不烧写
export async function addAudioToVideo(
  videoPath: string,
  audioPath: string,
  options: AddAudioOptions = {},
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

  // #region 按需把字幕烧写进合并结果
  if (options.subtitleZhPath || options.subtitleEnPath) {
    await burnSubtitleIntoOutput(outputPath, options.subtitleZhPath, options.subtitleEnPath, options.progressStream)
    logger?.log(`字幕已烧写进: ${outputPath}`)
  }
  // #endregion

  if (isBackupMode) logger?.log(`源视频已备份为: ${mergeInputPath}`)
  logger?.log(`已生成: ${outputPath}`)
  return outputPath
}

// 以源视频(或其备份)为输入调用 ffmpeg, 输出到合并结果路径
async function runMerge(
  ffmpegPath: string,
  inputPath: string,
  audioPath: string,
  outputPath: string,
): Promise<void> {
  // WebM 容器只允许 Vorbis/Opus 音频, WAV 等 PCM 格式必须转码
  const WEBM_AUDIO_CODECS = new Set(['opus', 'vorbis'])
  const outputExt = extname(outputPath).toLowerCase()
  const isWebmOutput = (outputExt === '.webm')
  const sourceAudioCodec = await readAudioCodec(audioPath)
  const isAudioCopyable = !isWebmOutput || ((sourceAudioCodec !== null) && WEBM_AUDIO_CODECS.has(sourceAudioCodec))

  return new Promise((resolve, reject) => {
    const audioArgs = isAudioCopyable
      ? ['-c:a', 'copy']
      : ['-c:a:0', 'libopus', '-b:a:0', '128k', '-c:a:1', 'copy']

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
      // 视频和字幕直接拷贝, 不重编码
      '-c:v', 'copy',
      '-c:s', 'copy',
      ...audioArgs,
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

// #region 烧写字幕
// 把中英字幕按各自样式烧写进合并结果: 先烧到 .burned 中间文件, 成功后替换合并结果, 输出文件名保持不变
// 至少传入一条字幕; 只传其一时另一路按缺省跳过
async function burnSubtitleIntoOutput(
  outputPath: string,
  subtitleZhPath: string | undefined,
  subtitleEnPath: string | undefined,
  progressStream?: NodeJS.WriteStream | null,
): Promise<void> {
  const burnedPath = buildBurnedPath(outputPath)
  // 中英文字幕同在底部区域, 中文靠 MarginV 抬高到英文上方; 先烧中文再烧英文, 叠放次序不影响可读性
  const subtitleInputs: SubtitleInput[] = []
  if (subtitleZhPath) subtitleInputs.push({path: subtitleZhPath, style: ZH_SUBTITLE_STYLE})
  if (subtitleEnPath) subtitleInputs.push({path: subtitleEnPath, style: EN_SUBTITLE_STYLE})

  try {
    // 不传 logger: "已生成"由替换完成后统一输出, 避免中间文件名误导
    await burnSubtitle(outputPath, subtitleInputs, {outputPath: burnedPath, progressStream})
  } catch (error) {
    // 烧写失败时清理半成品, 合并结果原样保留
    if (existsSync(burnedPath)) rmSync(burnedPath)
    throw error
  }

  rmSync(outputPath)
  renameSync(burnedPath, outputPath)
}
// #endregion