import {spawn} from 'node:child_process'
import {helpers} from 'ytdlp-nodejs'

import {readDuration} from './probe.js'

// #region 常量
// atempo 单次可接受的速率区间, 超出时拆成多个 atempo 串联
const ATEMPO_MAX = 2
const ATEMPO_MIN = 0.5
// #endregion

// #region 参数处理(纯函数)
// 速度倍率必须是正数: 大于 1 加速, 小于 1 减速
export function isValidSpeed(speed: number): boolean {
  return Number.isFinite(speed) && (speed > 0)
}

// 去掉多余的小数尾零, 让 1.50 显示为 1.5, 2.00 显示为 2
export function formatSpeed(speed: number): string {
  return String(Number(speed.toFixed(3)))
}

// 把倍率拆成多个处于 [0.5, 2] 的因子, 再串成 atempo 滤波器
export function buildAtempoFilter(speed: number): string {
  const factors: number[] = []
  let remaining = speed

  while (remaining > ATEMPO_MAX) {
    factors.push(ATEMPO_MAX)
    remaining /= ATEMPO_MAX
  }

  while (remaining < ATEMPO_MIN) {
    factors.push(ATEMPO_MIN)
    remaining /= ATEMPO_MIN
  }

  factors.push(remaining)

  return factors.map((factor) => `atempo=${formatSpeed(factor)}`).join(',')
}

// 输出到源文件旁, 文件名带上倍率: input.mp3 -> input.speed1.5x.mp3
export function buildSpeedChangedPath(audioPath: string, speed: number): string {
  return audioPath.replace(/(\.[^.]+)$/, `.speed${formatSpeed(speed)}x$1`)
}
// #endregion

// #region 调速
// 借助 atempo 变速不变调, 只重编码音频, 丢弃可能内嵌的封面等视频流
export async function changeAudioSpeed(
  audioPath: string,
  speed: number,
  logger?: {log: (message: string) => void},
): Promise<string> {
  const ffmpegPath = helpers.findFFmpegBinary()
  if (!ffmpegPath) {
    throw new Error('未找到 ffmpeg, 无法对音频调速')
  }

  const outputPath = buildSpeedChangedPath(audioPath, speed)

  // #region 预测输出时长
  // 倍速与时长成反比, 用源时长除以倍率即可预测(实际值受编码器对齐影响会有毫秒级偏差)
  const sourceDuration = await readDuration(audioPath)
  const predictedDuration = sourceDuration / speed
  logger?.log(`源文件时长: ${sourceDuration.toFixed(2)}s`)
  logger?.log(`预测输出时长: ${predictedDuration.toFixed(2)}s (${formatSpeed(speed)}x)`)
  // #endregion

  // #region 执行调速
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-v', 'error',
      '-y',
      '-i', audioPath,
      '-vn',
      '-af', buildAtempoFilter(speed),
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
        reject(new Error(`ffmpeg 音频调速失败 (退出码 ${code}): ${stderr.trim()}`))
      }
    })
  })
  // #endregion

  // #region 校验输出时长
  const outputDuration = await readDuration(outputPath)
  logger?.log(`实际输出时长: ${outputDuration.toFixed(2)}s`)
  logger?.log(`已生成: ${outputPath}`)
  // #endregion

  return outputPath
}
// #endregion