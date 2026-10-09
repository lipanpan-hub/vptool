// 这个命令的作用是把一个音频文件作为新音轨合并进视频
// 交互式选择视频与音频; 原声轨保留不动, 全程 copy 不重编码
// 新音轨通过 -map 顺序排到最前, 并被设置为默认声轨
// 源名不带 .old. 时先改名为 xxx.old.xxx 备份, 合并结果占用原文件名
// 源名带 .old. 时视为备份文件, 不再改名备份, 合并结果直接占用去 old 后的名字

import {Args, Command, Flags} from '@oclif/core'
import {existsSync, unlinkSync} from 'node:fs'
import prompts from 'prompts'

import {addAudioToVideo, buildBackupPath, buildOriginalPath} from '../../lib/fft/add-audio.js'
import {selectFile} from '../../lib/vtt/select-file.js'

// 仅扫描这些扩展名用于交互式选择
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.mov', '.avi', '.flv', '.webm', '.ts', '.m4v']
const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.wma']

export default class FftAddAudio extends Command {
  static aliases = ['fft:aa']

  static args = {
    video: Args.string({description: '源视频文件(省略则扫描当前目录交互选择)'}),
    audio: Args.string({description: '要加入的音轨文件(省略则扫描当前目录交互选择)'}),
  }

  static description = '把新音轨合并进视频: 原声轨保留, copy 不重编码, 新音轨置为默认并排在首位; 源视频备份为 .old, 结果占用原文件名; 源名带 .old. 时视为备份文件, 结果去除 .old 且不再备份'

  static examples = [
    '<%= config.bin %> <%= command.id %> input.mp4 bgm.mp3',
    '<%= config.bin %> <%= command.id %> input.mp4 bgm.mp3 --delete-audio',
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    'delete-audio': Flags.boolean({char: 'd', description: '合并成功后删除源音频文件(默认保留)'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(FftAddAudio)

    // #region 选择源视频
    const videoPath = args.video ?? (await selectFile(VIDEO_EXTENSIONS, '请选择要加入音轨的视频文件:'))
    if (!existsSync(videoPath)) this.error(`文件不存在: ${videoPath}`)
    // #endregion

    // #region 选择要合并的音轨
    const audioPath = args.audio ?? (await selectFile(AUDIO_EXTENSIONS, '请选择要加入的音轨文件:'))
    if (!existsSync(audioPath)) this.error(`文件不存在: ${audioPath}`)
    // #endregion

    // #region 计算输出路径与会被覆盖的文件
    // 源名带 .old. 段时结果去除 old; 否则结果占用原名, 由备份文件承受覆盖
    const outputPath = buildOriginalPath(videoPath)
    const isBackupMode = (outputPath === videoPath)
    const conflictPath = isBackupMode ? buildBackupPath(videoPath) : outputPath
    // #endregion

    // #region 会被覆盖的文件已存在时先询问
    if (existsSync(conflictPath)) {
      const {overwrite} = await prompts({
        message: `${conflictPath} 已存在, 是否覆盖?`,
        name: 'overwrite',
        type: 'confirm',
      })
      if (!overwrite) {
        this.log('已取消')
        return
      }
    }
    // #endregion

    // #region 执行合并
    this.log(`正在把 ${audioPath} 合并进 ${videoPath}...`)
    await addAudioToVideo(videoPath, audioPath, this)
    // #endregion

    // #region 按需删除源音频
    if (flags['delete-audio']) {
      unlinkSync(audioPath)
      this.log(`已删除音频文件: ${audioPath}`)
    }
    // #endregion
  }
}