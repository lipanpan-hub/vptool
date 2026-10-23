import {Args, Flags} from '@oclif/core'
import {existsSync, writeFileSync} from 'node:fs'
import {dirname, join, parse} from 'node:path'

import {BaseCommand} from '../../lib/base-command.js'
import {AudioCppClient, type AlignedWord} from '../../lib/auc/audiocpp-client.js'
import {cutWavChunk, offsetAlignedWords, planAudioChunks} from '../../lib/auc/audio-chunk.js'
import {prepareMono16kWav} from '../../lib/auc/audio-preprocess.js'
import {ToolConfigManager} from '../../lib/config/index.js'
import {selectFile} from '../../lib/vtt/select-file.js'
// 复用 sub 的模型就绪逻辑: 先卸载其他已加载模型腾显存, 再按 family 装载 ASR 与对齐模型
import {ensureModelsLoaded} from './sub.js'

// 常见音视频扩展名, 交互选择时据此过滤当前目录文件
const MEDIA_EXTENSIONS = [
  '.mp4', '.mkv', '.mov', '.avi', '.flv', '.webm', '.ts', '.m4v',
  '.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.wma',
]

export default class AucAsr extends BaseCommand {
  static description = '语音转文字 + 词级对齐(原始数据存同名 .json, 自动 ffmpeg 预处理为 16kHz 单声道; 不传文件时交互式选择)'

  static examples = [
    '<%= config.bin %> <%= command.id %> video.mp4',
    '<%= config.bin %> <%= command.id %> audio.wav --language zh --out transcript.txt',
    '<%= config.bin %> <%= command.id %>',
  ]

  static args = {
    // 支持任意音视频格式, 内部经 ffmpeg 抽取音轨; 缺省时扫描当前目录交互选择
    file: Args.string({description: '音视频文件路径(省略则交互选择)', required: false}),
  }

  static flags = {
    model: Flags.string({description: 'ASR 模型 id', default: 'qwen3_asr'}),
    // id 约定取 spec 的 family, 与 vp auc load/use 保持一致
    'align-model': Flags.string({description: '强制对齐模型 id', default: 'qwen3_forced_aligner'}),
    language: Flags.string({description: '音频语言代码', default: 'zh'}),
    out: Flags.string({description: '纯文本输出路径(缺省打印到终端)'}),
    port: Flags.integer({description: '服务监听端口(需与启动时一致)', default: 8080}),
    // 开启时自动就绪所需模型: 先卸载其他已加载模型腾出显存, ASR 与对齐模型未装载则自动装载
    'auto-load': Flags.boolean({description: '自动装载所需模型(卸载其他已加载模型, 再装载 ASR 与对齐模型)', default: true}),
  }

  public async run(): Promise<{rawOutputPath: string; text: string; textOutputPath?: string; wordCount: number}> {
    const {args, flags} = await this.parse(AucAsr)

    // #region 确定源文件(交互选择或直通)
    if (args.file === undefined) this.rejectInteractionInJsonMode('<file> 参数')
    const sourceFile = args.file ?? (await selectFile(MEDIA_EXTENSIONS, '请选择要转写的音视频文件:'))
    if (!existsSync(sourceFile)) this.error(`文件不存在: ${sourceFile}`)
    // #endregion

    const audioCppDir = ToolConfigManager.fromConfigDir(this.config.configDir).getAudioCppDir()
    if (audioCppDir === null) {
      this.error('未配置 audiocpp 目录, 请先执行: vp auc cfset <audiocpp目录>')
    }

    const client = new AudioCppClient({baseUrl: `http://127.0.0.1:${flags.port}`})
    if (flags['auto-load']) {
      await ensureModelsLoaded(client, audioCppDir, [flags.model, flags['align-model']], (message) => this.log(message))
    } else {
      await client.ensureModelLoaded(flags.model, '请先执行: vp auc load <模型目录> 或 vp auc models 查看状态')
      await client.ensureModelLoaded(flags['align-model'], '请先执行: vp auc load <模型目录> 或 vp auc models 查看状态')
    }

    this.log('正在预处理音频(16kHz 单声道)...')
    const preparedAudio = await prepareMono16kWav(sourceFile)

    try {
      // #region 分段转写 -> 对齐 -> 合并词级时间戳
      // 对齐模型无分块能力, 超长音频整段送 encoder 会超 max_source_positions,
      // 故按静音点切段后逐段"转写+对齐"(文本与音频天然配套), 段内时间戳平移回整段时间轴
      const chunkPlan = await planAudioChunks(preparedAudio.wavPath)
      const chunkCount = chunkPlan.chunks.length
      if (chunkCount > 1) {
        this.log(`音频时长 ${Math.round(chunkPlan.durationSeconds)} 秒, 按静音点分为 ${chunkCount} 段处理`)
      }

      let fullText = ''
      const alignedWords: AlignedWord[] = []
      for (const [chunkIndex, chunk] of chunkPlan.chunks.entries()) {
        const progressLabel = (chunkCount > 1) ? `(第 ${chunkIndex + 1}/${chunkCount} 段)` : ''
        const chunkWavPath = join(dirname(preparedAudio.wavPath), `chunk-${chunkIndex}.wav`)
        // eslint-disable-next-line no-await-in-loop -- 分段请求必须顺序执行, 且需要逐段反馈进度
        await cutWavChunk(preparedAudio.wavPath, chunk, chunkWavPath)

        this.log(`正在转写${progressLabel}(${flags.model})...`)
        // eslint-disable-next-line no-await-in-loop -- 分段请求必须顺序执行, 且需要逐段反馈进度
        const transcription = await client.transcribe({audioPath: chunkWavPath, modelId: flags.model, language: flags.language})
        this.log(`转写完成, 正在对齐${progressLabel}(${flags['align-model']})...`)
        // eslint-disable-next-line no-await-in-loop -- 分段请求必须顺序执行, 且需要逐段反馈进度
        const alignment = await client.align({
          audioPath: chunkWavPath,
          modelId: flags['align-model'],
          text: transcription.text,
          language: flags.language,
        })
        fullText += transcription.text
        alignedWords.push(...offsetAlignedWords(alignment.words, chunk.startSeconds))
      }
      // #endregion

      // #region 原始数据落盘与文本输出
      // 原始数据(全文 + 词级时间戳)保存到与输入文件同目录同名的 .json
      const parsedSource = parse(sourceFile)
      const rawOutputPath = join(parsedSource.dir, `${parsedSource.name}.json`)
      writeFileSync(rawOutputPath, JSON.stringify({text: fullText, words: alignedWords}, null, 2), 'utf8')
      this.log(`原始结果已保存(${alignedWords.length} 词): ${rawOutputPath}`)

      if (flags.out === undefined) {
        this.log('')
        this.log(fullText)
      } else {
        writeFileSync(flags.out, fullText, 'utf8')
        this.log(`已写入: ${flags.out}`)
      }

      return {rawOutputPath, text: fullText, textOutputPath: flags.out, wordCount: alignedWords.length}
      // #endregion
    } finally {
      await preparedAudio.cleanup()
    }
  }
}
