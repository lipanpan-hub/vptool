import {spawn} from 'node:child_process'
import {basename, dirname, extname, join} from 'node:path'
import prompts from 'prompts'
import {helpers} from 'ytdlp-nodejs'

// #region 类型定义
export interface SplitLogger {
  log(message: string): void
}

/** 单个片段的切割记录: 保留用户输入的时间文本, 便于日志与结果核对 */
export interface SplitSegmentRecord {
  end: string
  outputPath: string
  start: string
}

/** 单段执行器, 默认走 ffmpeg; 自测时可替换为不落盘的伪执行器 */
export type SegmentSplitExecutor = (
  videoPath: string,
  startText: string,
  endText: string,
  outputPath: string,
) => Promise<string>

export interface VideoSegmentSplitterOptions {
  executeSegment?: SegmentSplitExecutor
  logger?: SplitLogger
}
// #endregion

// #region 时间解析与校验
// 支持三种写法: 纯秒 "90" / "MM:SS" / "HH:MM:SS"(可带小数秒)
export function parseTimeToSeconds(input: string): number {
  const parts = input.trim().split(':').map(Number)
  if (parts.length === 0 || parts.some((num) => Number.isNaN(num))) {
    throw new Error(`时间格式无效: ${input}`)
  }

  // 从右往左依次是 秒/分/时, 权重为 60 的幂
  return parts.reverse().reduce((total, value, index) => total + (value * (60 ** index)), 0)
}

// 空串会被 Number('') 当成 0, 必须单独排除; 负数时间也没有切割意义
export function isValidTime(input: string): boolean {
  if (input.trim() === '') return false
  try {
    return parseTimeToSeconds(input) >= 0
  } catch {
    return false
  }
}

/** 起止区间校验, 返回 true 或可直接展示给用户的错误文案 */
export function validateSegmentRange(startText: string, endText: string): string | true {
  if (!isValidTime(startText)) return '时间格式无效, 请用秒数或 HH:MM:SS'
  if (!isValidTime(endText)) return '时间格式无效, 请用秒数或 HH:MM:SS'

  const startSec = parseTimeToSeconds(startText)
  const endSec = parseTimeToSeconds(endText)
  return (endSec > startSec) ? true : '结束时间必须晚于开始时间'
}
// #endregion

// #region 输出命名
/** 序号补零两位: _01/_02…; 超过 99 段后自然变为 _100, 不截断序号 */
export function buildSegmentOutputPath(videoPath: string, segmentNumber: number): string {
  const extension = extname(videoPath)
  const baseName = basename(videoPath, extension)
  const numberedName = `${baseName}_${String(segmentNumber).padStart(2, '0')}${extension}`
  return join(dirname(videoPath), numberedName)
}
// #endregion

// #region ffmpeg 单段切割
export async function splitVideoSegmentCopy(
  videoPath: string,
  startText: string,
  endText: string,
  outputPath: string,
): Promise<string> {
  // 无损快速切割: -c copy 不重编码, 直接拷贝原始音视频流
  const ffmpegPath = helpers.findFFmpegBinary()
  if (!ffmpegPath) {
    throw new Error('未找到 ffmpeg, 无法切割视频')
  }

  return new Promise((resolve, reject) => {
    // -ss/-to 置于 -i 之前做输入定位, 配合 -c copy 才能实现无损快速切割
    // -avoid_negative_ts make_zero 修正切割起点的时间戳, 避免开头黑屏/音画不同步
    const proc = spawn(ffmpegPath, [
      '-y', '-ss', startText, '-to', endText, '-i', videoPath,
      '-c', 'copy', '-avoid_negative_ts', 'make_zero', outputPath,
    ])
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath)
      } else {
        reject(new Error(`ffmpeg 切割视频失败 (退出码 ${code}): ${outputPath}`))
      }
    })
  })
}
// #endregion

// #region 多段切割
/**
 * 多段切割编排: 维护递增序号与已生成记录, 每录入一段就立即执行。
 * 交互复用项目内的 prompts(自测可经 prompts.inject 注入答案, 无需真实 TTY)。
 */
export class VideoSegmentSplitter {
  private readonly executeSegment: SegmentSplitExecutor
  private readonly logger?: SplitLogger
  private readonly segmentRecords: SplitSegmentRecord[] = []
  private nextSegmentNumber = 1
  private readonly videoPath: string

  constructor(videoPath: string, options: VideoSegmentSplitterOptions = {}) {
    this.videoPath = videoPath
    this.executeSegment = options.executeSegment ?? splitVideoSegmentCopy
    this.logger = options.logger
  }

  get segments(): readonly SplitSegmentRecord[] {
    return this.segmentRecords
  }

  get outputPaths(): string[] {
    return this.segmentRecords.map((record) => record.outputPath)
  }

  // #region 切割单段
  public async splitSegment(startText: string, endText: string): Promise<SplitSegmentRecord> {
    const segmentNumber = this.nextSegmentNumber
    this.nextSegmentNumber += 1

    const outputPath = buildSegmentOutputPath(this.videoPath, segmentNumber)
    this.logger?.log(`正在切割第 ${segmentNumber} 段 (${startText} → ${endText})...`)

    await this.executeSegment(this.videoPath, startText, endText, outputPath)

    const record: SplitSegmentRecord = {start: startText, end: endText, outputPath}
    this.segmentRecords.push(record)
    this.logger?.log(`已生成: ${outputPath}`)
    return record
  }
  // #endregion

  // #region 交互录入状态机
  public async runInteractive(): Promise<SplitSegmentRecord[]> {
    while (true) {
      // eslint-disable-next-line no-await-in-loop -- 逐段录入必须串行等待用户输入, 不能并行提问
      const startText = await this.askText(
        `第 ${this.nextSegmentNumber} 段开始时间(如 00:00:10 或 10):`,
        (value) => (isValidTime(value) ? true : '时间格式无效, 请用秒数或 HH:MM:SS'),
      )
      if (startText === undefined) break

      // eslint-disable-next-line no-await-in-loop -- 结束时间依赖本段开始时间, 必须串行询问
      const endText = await this.askText(
        `第 ${this.nextSegmentNumber} 段结束时间(如 00:00:30 或 30):`,
        (value) => validateSegmentRange(startText, value),
      )
      if (endText === undefined) break

      // eslint-disable-next-line no-await-in-loop -- 每段录完需立即切割, 并据结果决定是否继续
      await this.splitSegment(startText, endText)

      // 录完一段询问是否继续; 下一段序号已在 splitSegment 中递增
      // eslint-disable-next-line no-await-in-loop -- 是否继续必须等上一段切割完成后询问
      const {isContinue} = await prompts({
        initial: true,
        message: `是否继续录入第 ${this.nextSegmentNumber} 段?`,
        name: 'isContinue',
        type: 'confirm',
      })
      if (!isContinue) break
    }
    return this.segmentRecords
  }

  // 返回 undefined 表示用户按 Esc 结束录入
  private async askText(message: string, validate: (value: string) => string | true): Promise<string | undefined> {
    const {value} = await prompts({message, name: 'value', type: 'text', validate})
    return value === undefined ? undefined : (value as string).trim()
  }
  // #endregion
}
// #endregion
