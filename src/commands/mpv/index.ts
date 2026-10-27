// 交互式组装 mpv 播放命令:
// step1 从当前目录选视频(必选); step2 从当前目录与 .ytbflow 目录选 vtt 字幕(可跳过);
// step3 从同样范围选替换原声的音频(可跳过); mpv 同一时刻只播一条音轨, 外部音轨自动优先于内嵌音轨

import {Flags} from '@oclif/core'
import {spawn} from 'node:child_process'
import {join} from 'node:path'

import {BaseCommand} from '../../lib/base-command.js'
import {selectFile, selectOptionalFileFromDirs, type FileScanDir} from '../../lib/vtt/select-file.js'

// 仅扫描这些扩展名用于交互式选择
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.mov', '.avi', '.flv', '.webm', '.ts', '.m4v']
const SUBTITLE_EXTENSIONS = ['.vtt']
const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus']

// 字幕与音频的额外扫描目录名(相对当前目录)
const EXTRA_SCAN_DIR_NAME = '.ytbflow'

// 窗口适配大小默认值: 超过该尺寸的视频按宽高比缩到不超过它, 更小的视频保持原尺寸(不放大)
const DEFAULT_WINDOW_SIZE = '1280x720'
const WINDOW_SIZE_PATTERN = /^\d+x\d+$/

function isValidWindowSize(windowSize: string): boolean {
  if (!WINDOW_SIZE_PATTERN.test(windowSize)) return false
  const [width, height] = windowSize.split('x').map(Number)
  return (width > 0) && (height > 0)
}

export default class MpvPlay extends BaseCommand {
  static description =
    '交互式选择视频/vtt 字幕/音频后调用 mpv 播放: 字幕作为外挂字幕, 音频作为外部音轨替换视频原声'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --window-size 1920x1080',
  ]

  static flags = {
    'window-size': Flags.string({description: `mpv 窗口适配大小, 格式 WxH(视频按宽高比缩放, 不超过该尺寸), 默认 ${DEFAULT_WINDOW_SIZE}`}),
  }

  public async run(): Promise<{command: string; exitCode: number}> {
    this.rejectInteractiveOnlyInJsonMode('文件只能交互式选择')
    const {flags} = await this.parse(MpvPlay)

    // #region 校验窗口大小参数
    const windowSize = flags['window-size'] ?? DEFAULT_WINDOW_SIZE
    if (!isValidWindowSize(windowSize)) {
      this.error(`窗口大小格式无效, 应为 WxH 且宽高大于 0: ${windowSize}`)
    }
    // #endregion

    // #region step1 选择视频文件(必选)
    const videoPath = await selectFile(VIDEO_EXTENSIONS, '请选择要播放的视频文件:')
    // #endregion

    // #region step2/3 选择 vtt 字幕与音频文件(找不到候选时自动跳过, 也可主动选跳过)
    const scanDirs: readonly FileScanDir[] = [
      {label: '当前目录', path: process.cwd()},
      {label: EXTRA_SCAN_DIR_NAME, path: join(process.cwd(), EXTRA_SCAN_DIR_NAME)},
    ]

    const subtitlePath = await selectOptionalFileFromDirs(scanDirs, SUBTITLE_EXTENSIONS, '请选择 vtt 字幕文件(回车选首项即跳过):')
    if (subtitlePath === undefined) this.log('未找到/未选择字幕, 跳过字幕')

    const audioPath = await selectOptionalFileFromDirs(scanDirs, AUDIO_EXTENSIONS, '请选择替换原声的音频文件(回车选首项即跳过):')
    if (audioPath === undefined) this.log('未找到/未选择音频, 跳过音轨替换')
    // #endregion

    // #region 组装 mpv 命令并播放
    // --autofit 限制窗口最大尺寸并保持宽高比, 小视频不会被放大
    const mpvArgs = [videoPath, `--autofit=${windowSize}`]
    if (subtitlePath !== undefined) mpvArgs.push(`--sub-file=${subtitlePath}`)
    if (audioPath !== undefined) mpvArgs.push(`--audio-file=${audioPath}`)

    const commandText = `mpv ${mpvArgs.join(' ')}`
    this.log(`执行: ${commandText}`)

    const exitCode = await this.spawnMpv(mpvArgs)
    return {command: commandText, exitCode}
    // #endregion
  }

  // stdio inherit 让 mpv 接管终端(窗口播放+按键控制), 播放结束取回退出码
  private spawnMpv(args: string[]): Promise<number> {
    return new Promise((resolve, reject) => {
      const child = spawn('mpv', args, {stdio: 'inherit'})
      child.on('error', (error) => {
        const isNotFound = (error as NodeJS.ErrnoException).code === 'ENOENT'
        reject(isNotFound ? new Error('未找到 mpv 可执行文件, 请先安装 mpv 并加入 PATH') : error)
      })
      child.on('exit', (code) => resolve(code ?? 0))
    })
  }
}
