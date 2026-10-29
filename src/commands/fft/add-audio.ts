// 这个命令的作用是把一个音频文件作为新音轨合并进视频
// 交互式选择视频与音频; 原声轨保留不动, 全程 copy 不重编码
// 新音轨通过 -map 顺序排到最前, 并被设置为默认声轨
// 音频与字幕的交互选择范围: 当前目录 + 当前目录下的 .ytbflow 目录
// 源名不带 .old. 时先改名为 xxx.old.xxx 备份, 合并结果占用原文件名
// 源名带 .old. 时视为备份文件, 不再改名备份, 合并结果直接占用去 old 后的名字
// 可选烧写中英双字幕(此时视频重编码): 同在底部区域, 中文在上大字号, 英文在下小字号半透明仅作对照且永远单行显示
// 用 --subtitle-zh/--subtitle-en 传入, 或交互确认后分别选择; 两路都未选则不烧写

import {Args, Flags} from '@oclif/core'
import {existsSync, unlinkSync} from 'node:fs'
import {join} from 'node:path'
import prompts from 'prompts'

import {BaseCommand} from '../../lib/base-command.js'
import {addAudioToVideo, buildBackupPath, buildOriginalPath} from '../../lib/fft/add-audio.js'
import {selectFile, selectFileFromDirs, selectOptionalFileFromDirs, type FileScanDir} from '../../lib/vtt/select-file.js'

// 仅扫描这些扩展名用于交互式选择
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.mov', '.avi', '.flv', '.webm', '.ts', '.m4v']
const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.wma']
const SUBTITLE_EXTENSIONS = ['.vtt']

// 音频与字幕的额外扫描目录名(相对当前目录)
const EXTRA_SCAN_DIR_NAME = '.ytbflow'

export default class FftAddAudio extends BaseCommand {
  static aliases = ['fft:aa']

  static args = {
    video: Args.string({description: '源视频文件(省略则扫描当前目录交互选择)'}),
    audio: Args.string({description: '要加入的音轨文件(省略则扫描当前目录交互选择)'}),
  }

  static description = '把新音轨合并进视频: 原声轨保留, copy 不重编码, 新音轨置为默认并排在首位; 源视频备份为 .old, 结果占用原文件名; 源名带 .old. 时视为备份文件, 结果去除 .old 且不再备份; 可选烧写中英双字幕(同在底部区域, 中文在上大字号, 英文在下小字号半透明)'

  static examples = [
    '<%= config.bin %> <%= command.id %> input.mp4 bgm.mp3',
    '<%= config.bin %> <%= command.id %> input.mp4 bgm.mp3 --subtitle-zh zh.vtt --subtitle-en en.vtt',
    '<%= config.bin %> <%= command.id %> input.mp4 bgm.mp3 --delete-audio',
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    'delete-audio': Flags.boolean({char: 'd', description: '合并成功后删除源音频文件(默认保留)'}),
    'subtitle-en': Flags.string({description: '要烧写的英文 vtt 字幕文件(底部小字号半透明仅作对照, 永远单行显示; 省略则交互询问)'}),
    'subtitle-zh': Flags.string({description: '要烧写的中文 vtt 字幕文件(底部居中抬高到英文上方, 大字号; 省略则交互询问)'}),
  }

  public async run(): Promise<{
    audioPath: string
    backupPath: null | string
    isAudioDeleted: boolean
    outputPath: null | string
    subtitleEnPath: null | string
    subtitleZhPath: null | string
    videoPath: string
  }> {
    const {args, flags} = await this.parse(FftAddAudio)

    // #region 选择源视频
    if (!args.video) this.rejectInteractionInJsonMode('<video> 参数')
    const videoPath = args.video ?? (await selectFile(VIDEO_EXTENSIONS, '请选择要加入音轨的视频文件:'))
    if (!existsSync(videoPath)) this.error(`文件不存在: ${videoPath}`)
    // #endregion

    // #region 音频与字幕的扫描范围: 当前目录 + .ytbflow 目录
    const scanDirs: readonly FileScanDir[] = [
      {label: '当前目录', path: process.cwd()},
      {label: EXTRA_SCAN_DIR_NAME, path: join(process.cwd(), EXTRA_SCAN_DIR_NAME)},
    ]
    // #endregion

    // #region 选择要合并的音轨
    if (!args.audio) this.rejectInteractionInJsonMode('<audio> 参数')
    const audioPath = args.audio ?? (await selectFileFromDirs(scanDirs, AUDIO_EXTENSIONS, '请选择要加入的音轨文件:'))
    if (!existsSync(audioPath)) this.error(`文件不存在: ${audioPath}`)
    // #endregion

    // #region 确定要烧写的中英字幕
    const {subtitleEnPath, subtitleZhPath} = await this.resolveSubtitlePaths(flags, scanDirs)
    // #endregion

    // #region 计算输出路径与会被覆盖的文件
    // 源名带 .old. 段时结果去除 old; 否则结果占用原名, 由备份文件承受覆盖
    const outputPath = buildOriginalPath(videoPath)
    const isBackupMode = (outputPath === videoPath)
    const conflictPath = isBackupMode ? buildBackupPath(videoPath) : outputPath
    // #endregion

    // #region 会被覆盖的文件已存在时先询问
    if (existsSync(conflictPath)) {
      this.rejectInteractionInJsonMode(`先删除已存在的文件 ${conflictPath}(该命令无 --force, 覆盖需交互确认)`)
      const {overwrite} = await prompts({
        message: `${conflictPath} 已存在, 是否覆盖?`,
        name: 'overwrite',
        type: 'confirm',
      })
      if (!overwrite) {
        this.log('已取消')
        return {
          audioPath,
          backupPath: null,
          isAudioDeleted: false,
          outputPath: null,
          subtitleEnPath: subtitleEnPath ?? null,
          subtitleZhPath: subtitleZhPath ?? null,
          videoPath,
        }
      }
    }
    // #endregion

    // #region 执行合并
    this.log(`正在把 ${audioPath} 合并进 ${videoPath}...`)
    // JSON 模式下不显示烧写进度, 保证输出只有结果 JSON
    const progressStream = this.jsonEnabled() ? null : process.stdout
    await addAudioToVideo(videoPath, audioPath, {
      progressStream,
      subtitleEnPath: subtitleEnPath ?? undefined,
      subtitleZhPath: subtitleZhPath ?? undefined,
    }, this)
    // #endregion

    // #region 按需删除源音频
    if (flags['delete-audio']) {
      unlinkSync(audioPath)
      this.log(`已删除音频文件: ${audioPath}`)
    }
    // #endregion

    return {
      audioPath,
      backupPath: isBackupMode ? conflictPath : null,
      isAudioDeleted: flags['delete-audio'],
      outputPath,
      subtitleEnPath: subtitleEnPath ?? null,
      subtitleZhPath: subtitleZhPath ?? null,
      videoPath,
    }
  }

  // 确定要烧写的中英字幕: --subtitle-zh/--subtitle-en 优先; 交互模式下未传的各询问一次(均可跳过); JSON 模式不询问
  private async resolveSubtitlePaths(
    flags: {'subtitle-en'?: string; 'subtitle-zh'?: string},
    scanDirs: readonly FileScanDir[],
  ): Promise<{subtitleEnPath?: string; subtitleZhPath?: string}> {
    // #region 中文字幕
    let subtitleZhPath = flags['subtitle-zh']
    if (!subtitleZhPath && !this.jsonEnabled()) {
      subtitleZhPath = await selectOptionalFileFromDirs(scanDirs, SUBTITLE_EXTENSIONS, '请选择要烧写的中文字幕文件(回车选首项即跳过):')
    }
    // #endregion

    // #region 英文字幕
    let subtitleEnPath = flags['subtitle-en']
    if (!subtitleEnPath && !this.jsonEnabled()) {
      subtitleEnPath = await selectOptionalFileFromDirs(scanDirs, SUBTITLE_EXTENSIONS, '请选择要烧写的英文字幕文件(回车选首项即跳过):')
    }
    // #endregion

    // #region 校验字幕文件存在
    for (const subtitlePath of [subtitleZhPath, subtitleEnPath]) {
      if (subtitlePath && !existsSync(subtitlePath)) this.error(`文件不存在: ${subtitlePath}`)
    }
    // #endregion

    return {subtitleEnPath, subtitleZhPath}
  }
}