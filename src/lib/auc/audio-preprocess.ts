import {spawn} from 'node:child_process'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {helpers} from 'ytdlp-nodejs'

/**
 * 音频预处理结果
 */
export interface PreparedAudio {
  // 16kHz 单声道 wav 路径
  wavPath: string
  // 释放临时目录
  cleanup: () => Promise<void>
}

/**
 * 将任意音视频文件转为 16kHz 单声道 wav 临时文件。
 * 对齐接口的秒级时间戳依赖 16kHz 采样率, 统一预处理同时减小上传体积。
 */
export async function prepareMono16kWav(sourcePath: string): Promise<PreparedAudio> {
  const ffmpegPath = helpers.findFFmpegBinary()
  if (!ffmpegPath) {
    throw new Error('未找到 ffmpeg, 无法预处理音频, 请先执行: vp dl check --update')
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'vptool-auc-'))
  const wavPath = join(tempDir, 'audio16k.wav')

  const exitCode = await new Promise<number>((resolve, reject) => {
    // -vn 丢弃视频流, 只保留音轨; 16kHz 单声道 pcm_s16le 为对齐接口要求
    const proc = spawn(ffmpegPath, [
      '-y',
      '-i', sourcePath,
      '-vn',
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      wavPath,
    ])
    proc.on('error', reject)
    proc.on('close', (code) => resolve(code ?? -1))
  })

  if (exitCode !== 0) {
    await rm(tempDir, {recursive: true, force: true})
    throw new Error(`ffmpeg 音频预处理失败 (退出码 ${exitCode}), 源文件: ${sourcePath}`)
  }

  return {
    wavPath,
    cleanup: async () => {
      await rm(tempDir, {recursive: true, force: true})
    },
  }
}
