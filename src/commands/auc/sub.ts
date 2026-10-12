import {Args, Flags} from '@oclif/core'
import {existsSync, writeFileSync} from 'node:fs'
import {dirname, extname, join, basename} from 'node:path'

import {BaseCommand} from '../../lib/base-command.js'
import {AudioCppClient, type AlignedWord} from '../../lib/auc/audiocpp-client.js'
import {cutWavChunk, offsetAlignedWords, planAudioChunks} from '../../lib/auc/audio-chunk.js'
import {prepareMono16kWav} from '../../lib/auc/audio-preprocess.js'
import {listModelCandidates} from '../../lib/auc/model-locator.js'
import {createSubtitleFormatter, splitWordsIntoCues, type CueSplitOptions} from '../../lib/auc/subtitle-builder.js'
import {ToolConfigManager} from '../../lib/config/index.js'
import {selectFile} from '../../lib/vtt/select-file.js'

// 常见音视频扩展名, 交互选择时据此过滤当前目录文件
const MEDIA_EXTENSIONS = [
  '.mp4', '.mkv', '.mov', '.avi', '.flv', '.webm', '.ts', '.m4v',
  '.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.wma',
]

export default class AucSub extends BaseCommand {
  static description = '为音视频生成字幕文件(转写 + 强制对齐, 输出 VTT/SRT, 需已装载 ASR 与对齐模型; 不传文件时交互式选择)'

  static examples = [
    '<%= config.bin %> <%= command.id %> video.mp4',
    '<%= config.bin %> <%= command.id %> video.mp4 --format srt --max-chars 14 --max-seconds 4',
    '<%= config.bin %> <%= command.id %> video.mp4 --auto-load',
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
    format: Flags.string({description: '字幕格式: vtt | srt', default: 'vtt'}),
    'max-chars': Flags.integer({description: '单条字幕最大字符数', default: 18}),
    'max-seconds': Flags.integer({description: '单条字幕最大时长(秒)', default: 5}),
    out: Flags.string({description: '字幕输出路径(缺省与源文件同名)'}),
    // 开启时把每条字幕文本逐行抽出, 写成与字幕同名的 .txt 纯文本文档
    txt: Flags.boolean({description: '同时生成同名 txt 纯文本文档(每条字幕一行)', default: false}),
    port: Flags.integer({description: '服务监听端口(需与启动时一致)', default: 8080}),
    // 开启时自动就绪所需模型: 先卸载其他已加载模型腾出显存, ASR 与对齐模型未装载则自动装载
    'auto-load': Flags.boolean({description: '自动装载所需模型(卸载其他已加载模型, 再装载 ASR 与对齐模型)', default: true}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(AucSub)

    // #region 确定源文件(交互选择或直通)
    const sourceFile = args.file ?? (await selectFile(MEDIA_EXTENSIONS, '请选择要生成字幕的音视频文件:'))
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
      // 故按静音点切段后逐段"转写+对齐", 段内时间戳平移回整段时间轴
      const chunkPlan = await planAudioChunks(preparedAudio.wavPath)
      const chunkCount = chunkPlan.chunks.length
      if (chunkCount > 1) {
        this.log(`音频时长 ${Math.round(chunkPlan.durationSeconds)} 秒, 按静音点分为 ${chunkCount} 段处理`)
      }

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
        alignedWords.push(...offsetAlignedWords(alignment.words, chunk.startSeconds))
      }
      // #endregion

      // #region 分段并写出字幕
      const splitOptions: CueSplitOptions = {maxChars: flags['max-chars'], maxSeconds: flags['max-seconds']}
      const cues = splitWordsIntoCues(alignedWords, splitOptions)
      const subtitleContent = createSubtitleFormatter(flags.format).format(cues)

      const outputPath = flags.out ?? buildDefaultSubtitlePath(sourceFile, flags.format)
      writeFileSync(outputPath, subtitleContent, 'utf8')
      this.log(`已生成字幕(${cues.length} 条): ${outputPath}`)

      if (flags.txt) {
        const textPath = buildSidecarTextPath(outputPath)
        writeFileSync(textPath, buildPlainTextContent(cues), 'utf8')
        this.log(`已生成纯文本文档(${cues.length} 行): ${textPath}`)
      }
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

// 纯文本文档路径: 与字幕文件同目录同名, 扩展名替换为 txt
function buildSidecarTextPath(subtitlePath: string): string {
  return join(dirname(subtitlePath), `${basename(subtitlePath, extname(subtitlePath))}.txt`)
}

// 纯文本文档内容: 每条字幕文本独占一行
function buildPlainTextContent(cues: {text: string}[]): string {
  return `${cues.map((cue) => cue.text).join('\n')}\n`
}

// 自动就绪 sub 所需的 ASR 与对齐模型:
// 先卸载目标之外的其他已加载模型腾出显存(与 vp auc use 的切换语义一致),
// 再从本地 models 目录按 family 定位权重装载; 目标模型已加载的跳过, 避免重复装载耗时。
// (导出仅为便于 testmp 自测)
export async function ensureModelsLoaded(
  client: AudioCppClient,
  audioCppDir: string,
  targetModelIds: string[],
  log: (message: string) => void,
): Promise<void> {
  // #region 卸载目标之外的其他已加载模型(显存有限)
  const models = await client.listModels()
  const isTargetModel = (modelId: string) => targetModelIds.includes(modelId)
  for (const loadedModel of models.filter((model) => (model.loaded && (!isTargetModel(model.id))))) {
    // eslint-disable-next-line no-await-in-loop -- 逐个卸载需按服务端顺序确认
    await client.unloadModel(loadedModel.id)
    log(`已卸载: ${loadedModel.id} (task=${loadedModel.task})`)
  }
  // #endregion

  // #region 按需装载 ASR 与对齐模型
  // 本地候选按 family 匹配(id 约定取 family, 与 load/use 一致); 同 family 存在多精度候选时取第一个
  const candidates = listModelCandidates(audioCppDir)
  for (const targetModelId of targetModelIds) {
    const registeredModel = models.find((model) => model.id === targetModelId)
    if (registeredModel?.loaded) {
      log(`模型已加载, 跳过装载: ${targetModelId}`)
      continue
    }
    const candidate = candidates.find((item) => item.family === targetModelId)
    if (candidate === undefined) {
      throw new Error(`models 目录下找不到 family=${targetModelId} 的模型包, 请先执行: vp auc load <模型目录>`)
    }
    log(`正在装载: id=${targetModelId} task=${candidate.task} path=${candidate.weightsPath}`)
    // eslint-disable-next-line no-await-in-loop -- 装载需顺序执行
    await client.loadModel({id: targetModelId, path: candidate.weightsPath, family: candidate.family, task: candidate.task})
  }
  // #endregion
}
