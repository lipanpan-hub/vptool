import {spawn} from 'node:child_process'
import {helpers} from 'ytdlp-nodejs'

// #region 目标格式注册表
// 每种目标格式对应 ffmpeg 的音频编码参数与输出扩展名; 新增格式只需增加一行
export interface AudioTargetFormat {
  // ffmpeg 编码参数(不含输入输出文件)
  args: string[]
  description: string
  extension: string
  label: string
}

export const AUDIO_TARGET_FORMATS: AudioTargetFormat[] = [
  {args: ['-c:a', 'libmp3lame', '-b:a', '192k'], description: '有损, 兼容性最好', extension: 'mp3', label: 'MP3 (192kbps)'},
  {args: ['-c:a', 'aac', '-b:a', '192k'], description: '有损, 苹果生态友好', extension: 'm4a', label: 'M4A/AAC (192kbps)'},
  {args: ['-c:a', 'aac', '-b:a', '192k'], description: '有损 AAC 裸流', extension: 'aac', label: 'AAC (192kbps)'},
  {args: ['-c:a', 'libvorbis', '-q:a', '5'], description: '有损, 开源格式', extension: 'ogg', label: 'OGG Vorbis'},
  {args: ['-c:a', 'libopus', '-b:a', '128k'], description: '有损, 低码率音质佳', extension: 'opus', label: 'Opus (128kbps)'},
  {args: ['-c:a', 'wmav2', '-b:a', '192k'], description: '有损, Windows 生态', extension: 'wma', label: 'WMA (192kbps)'},
  {args: ['-c:a', 'flac'], description: '无损压缩, 体积中等', extension: 'flac', label: 'FLAC (无损)'},
  {args: ['-c:a', 'pcm_s16le'], description: '无损未压缩, 体积大', extension: 'wav', label: 'WAV (无损 PCM)'},
]
// #endregion

// #region 输出路径计算
export function buildReencodedPath(audioPath: string, extension: string): string {
  const replaced = audioPath.replace(/\.[^.]+$/, `.${extension}`)

  // 目标后缀与源文件相同时会覆盖源文件, 插入 .reencoded 加以区分
  return (replaced === audioPath) ? audioPath.replace(/(\.[^.]+)$/, '.reencoded$1') : replaced
}
// #endregion

// 按目标格式重新编码音频, 返回输出文件路径
export async function reencodeAudio(
  audioPath: string,
  target: AudioTargetFormat,
  logger?: {log: (message: string) => void},
): Promise<string> {
  const ffmpegPath = helpers.findFFmpegBinary()
  if (!ffmpegPath) {
    throw new Error('未找到 ffmpeg, 无法重新编码音频')
  }

  const outputPath = buildReencodedPath(audioPath, target.extension)

  return new Promise((resolve, reject) => {
    // -vn 丢弃可能存在的视频流(如内嵌封面), 保证只输出纯音频
    const proc = spawn(ffmpegPath, ['-y', '-i', audioPath, '-vn', ...target.args, outputPath])
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) {
        logger?.log(`已生成: ${outputPath}`)
        resolve(outputPath)
      } else {
        reject(new Error(`ffmpeg 重新编码音频失败 (退出码 ${code})`))
      }
    })
  })
}