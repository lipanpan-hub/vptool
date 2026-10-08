// 这个命令的作用是把 vtt 字幕永久烧写(硬字幕)进视频画面
// 交互式选择视频与字幕文件; 字幕要合成进画面, 视频必须重编码, 音频保持不重编码

import {Args, Command, Flags} from '@oclif/core'
import {existsSync} from 'node:fs'
import prompts from 'prompts'

import {
  burnSubtitle,
  buildBurnedPath,
  isValidAlignment,
  isValidCrf,
  isValidHexColor,
  MAX_CRF,
  MIN_CRF,
  SubtitleStyle,
} from '../../lib/fft/burn-subtitle.js'
import {selectFile} from '../../lib/vtt/select-file.js'

// 仅扫描这些扩展名用于交互式选择
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.mov', '.avi', '.flv', '.webm', '.ts', '.m4v']
const SUBTITLE_EXTENSIONS = ['.vtt']

export default class FftBurnSubtitle extends Command {
  static aliases = ['fft:bs']

  static args = {
    video: Args.string({description: '源视频文件(省略则扫描当前目录交互选择)'}),
    subtitle: Args.string({description: '要烧写的 vtt 字幕文件(省略则扫描当前目录交互选择)'}),
  }

  static description = '把 vtt 字幕烧写(硬字幕)进视频画面: webm 走 AV1 编码, 其余容器优先用 NVENC 硬件编码'

  static examples = [
    '<%= config.bin %> <%= command.id %> input.mp4 sub.vtt',
    '<%= config.bin %> <%= command.id %> input.mp4 sub.vtt --font-size 28 --font-color "#FFFFFF"',
    '<%= config.bin %> <%= command.id %> input.mp4 sub.vtt --alignment 2 --margin-v 40 --crf 20',
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    alignment: Flags.integer({description: '字幕位置(ASS 布局 1-9: 1/2/3 底部, 4/5/6 中部, 7/8/9 顶部, 默认 2)'}),
    crf: Flags.integer({description: `视频质量 CRF(${MIN_CRF}-${MAX_CRF}, 越小越清晰; webm/AV1 默认 35, 其它容器默认 23)`}),
    'font-color': Flags.string({description: '字幕填充色, 十六进制 #RRGGBB'}),
    'font-name': Flags.string({description: '字体名(如 "微软雅黑"), 缺省用 ffmpeg 默认字体'}),
    'font-size': Flags.integer({description: '字号(默认 24)'}),
    force: Flags.boolean({char: 'f', description: '输出文件已存在时直接覆盖, 不再询问'}),
    'margin-v': Flags.integer({description: '字幕距画面边缘的垂直像素'}),
    'outline-color': Flags.string({description: '字幕描边颜色, 十六进制 #RRGGBB'}),
    output: Flags.string({char: 'o', description: '输出文件路径(默认在源文件旁生成带 .burned 后缀的新文件)'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(FftBurnSubtitle)

    // #region 校验命令行传入的样式与编码参数
    if ((flags.crf !== undefined) && !isValidCrf(flags.crf)) {
      this.error(`CRF 必须在 ${MIN_CRF}-${MAX_CRF} 之间: ${flags.crf}`)
    }

    if ((flags.alignment !== undefined) && !isValidAlignment(flags.alignment)) {
      this.error(`字幕位置必须在 1-9 之间: ${flags.alignment}`)
    }

    const fontColor = flags['font-color']
    if (fontColor && !isValidHexColor(fontColor)) {
      this.error(`字幕颜色格式无效, 应为 #RRGGBB: ${fontColor}`)
    }

    const outlineColor = flags['outline-color']
    if (outlineColor && !isValidHexColor(outlineColor)) {
      this.error(`描边颜色格式无效, 应为 #RRGGBB: ${outlineColor}`)
    }
    // #endregion

    // #region 选择源视频
    const videoPath = args.video ?? (await selectFile(VIDEO_EXTENSIONS, '请选择要烧写字幕的视频文件:'))
    if (!existsSync(videoPath)) this.error(`文件不存在: ${videoPath}`)
    // #endregion

    // #region 选择字幕文件
    const subtitlePath = args.subtitle ?? (await selectFile(SUBTITLE_EXTENSIONS, '请选择要烧写的 vtt 字幕文件:'))
    if (!existsSync(subtitlePath)) this.error(`文件不存在: ${subtitlePath}`)
    // #endregion

    // #region 输出已存在时按 --force 决定是否覆盖
    const outputPath = flags.output ?? buildBurnedPath(videoPath)
    if (existsSync(outputPath) && !flags.force) {
      const {overwrite} = await prompts({
        message: `${outputPath} 已存在, 是否覆盖?`,
        name: 'overwrite',
        type: 'confirm',
      })
      if (!overwrite) {
        this.log('已取消')
        return
      }
    }
    // #endregion

    // #region 执行烧写
    const style: SubtitleStyle = {
      alignment: flags.alignment,
      fontColor,
      fontName: flags['font-name'],
      fontSize: flags['font-size'],
      marginV: flags['margin-v'],
      outlineColor,
    }

    this.log(`正在把 ${subtitlePath} 烧写进 ${videoPath}...`)
    await burnSubtitle(videoPath, subtitlePath, {crf: flags.crf, outputPath, style}, this)
    // #endregion
  }
}