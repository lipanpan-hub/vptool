import {Args, Flags} from '@oclif/core'
import {writeFileSync} from 'node:fs'
import {dirname, extname, join, basename} from 'node:path'

import {BaseCommand} from '../../lib/base-command.js'
import {AudioCppClient} from '../../lib/auc/audiocpp-client.js'
import {prepareMono16kWav} from '../../lib/auc/audio-preprocess.js'
import {createSubtitleFormatter, splitWordsIntoCues, type CueSplitOptions} from '../../lib/auc/subtitle-builder.js'
import {ToolConfigManager} from '../../lib/config/index.js'

export default class AucSub extends BaseCommand {
  static description = '为音视频生成字幕文件(转写 + 强制对齐, 输出 VTT/SRT, 需已装载 ASR 与对齐模型)'

  static examples = [
    '<%= config.bin %> <%= command.id %> video.mp4',
    '<%= config.bin %> <%= command.id %> video.mp4 --format srt --max-chars 14 --max-seconds 4',
  ]

  static args = {
    // 支持任意音视频格式, 内部经 ffmpeg 抽取音轨
    file: Args.file({description: '音视频文件路径', required: true}),
  }

  static flags = {
    model: Flags.string({description: 'ASR 模型 id', default: 'qwen3_asr'}),
    // id 约定取 spec 的 family, 与 vp auc load/use 保持一致
    'align-model': Flags.string({description: '强制对齐模型 id', default: 'qwen3_forced_aligner'}),
    language: Flags.string({description: '音频语言代码', default: 'zh'}),
    format: Flags.string({description: '字幕格式: vtt | srt', default: 'vtt'}),
    'max-chars': Flags.integer({description: '单条字幕最大字符数', default: 18}),
    'max-seconds': Flags.integer({description: '单条字幕最大时长(秒)', default: 5}),
    out: Flags.string({description: '字幕输出路径(缺省与源文件同名)'}),
    port: Flags.integer({description: '服务监听端口(需与启动时一致)', default: 8080}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(AucSub)

    const audioCppDir = ToolConfigManager.fromConfigDir(this.config.configDir).getAudioCppDir()
    if (audioCppDir === null) {
      this.error('未配置 audiocpp 目录, 请先执行: vp auc cfset <audiocpp目录>')
    }

    const client = new AudioCppClient({baseUrl: `http://127.0.0.1:${flags.port}`})
    await client.ensureModelLoaded(flags.model, '请先执行: vp auc load <模型目录> 或 vp auc models 查看状态')
    await client.ensureModelLoaded(flags['align-model'], '请先执行: vp auc load <模型目录> 或 vp auc models 查看状态')

    this.log('正在预处理音频(16kHz 单声道)...')
    const preparedAudio = await prepareMono16kWav(args.file)

    try {
      // #region 转写 -> 对齐
      this.log(`正在转写(${flags.model})...`)
      const transcription = await client.transcribe({audioPath: preparedAudio.wavPath, modelId: flags.model, language: flags.language})
      this.log(`转写完成, 正在对齐(${flags['align-model']})...`)

      const alignment = await client.align({
        audioPath: preparedAudio.wavPath,
        modelId: flags['align-model'],
        text: transcription.text,
        language: flags.language,
      })
      // #endregion

      // #region 分段并写出字幕
      const splitOptions: CueSplitOptions = {maxChars: flags['max-chars'], maxSeconds: flags['max-seconds']}
      const cues = splitWordsIntoCues(alignment.words, splitOptions)
      const subtitleContent = createSubtitleFormatter(flags.format).format(cues)

      const outputPath = flags.out ?? buildDefaultSubtitlePath(args.file, flags.format)
      writeFileSync(outputPath, subtitleContent, 'utf8')
      this.log(`已生成字幕(${cues.length} 条): ${outputPath}`)
      // #endregion
    } finally {
      await preparedAudio.cleanup()
    }
  }
}

// 缺省输出路径: 与源文件同目录同名, 扩展名替换为字幕格式
function buildDefaultSubtitlePath(sourceFile: string, formatName: string): string {
  return join(dirname(sourceFile), `${basename(sourceFile, extname(sourceFile))}.${formatName}`)
}
