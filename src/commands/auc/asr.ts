import {Args, Flags} from '@oclif/core'
import {writeFileSync} from 'node:fs'

import {BaseCommand} from '../../lib/base-command.js'
import {AudioCppClient} from '../../lib/auc/audiocpp-client.js'
import {prepareMono16kWav} from '../../lib/auc/audio-preprocess.js'
import {ToolConfigManager} from '../../lib/config/index.js'

export default class AucAsr extends BaseCommand {
  static description = '语音转文字(自动 ffmpeg 预处理为 16kHz 单声道, 需已装载 ASR 模型)'

  static examples = [
    '<%= config.bin %> <%= command.id %> video.mp4',
    '<%= config.bin %> <%= command.id %> audio.wav --language zh --out transcript.txt',
  ]

  static args = {
    // 支持任意音视频格式, 内部经 ffmpeg 抽取音轨
    file: Args.file({description: '音视频文件路径', required: true}),
  }

  static flags = {
    model: Flags.string({description: 'ASR 模型 id', default: 'qwen3_asr'}),
    language: Flags.string({description: '音频语言代码', default: 'zh'}),
    out: Flags.string({description: '文本输出路径(缺省打印到终端)'}),
    port: Flags.integer({description: '服务监听端口(需与启动时一致)', default: 8080}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(AucAsr)

    const audioCppDir = ToolConfigManager.fromConfigDir(this.config.configDir).getAudioCppDir()
    if (audioCppDir === null) {
      this.error('未配置 audiocpp 目录, 请先执行: vp auc cfset <audiocpp目录>')
    }

    const client = new AudioCppClient({baseUrl: `http://127.0.0.1:${flags.port}`})
    await client.ensureModelLoaded(flags.model, `请先执行: vp auc load <模型目录> 或 vp auc models 查看状态`)

    this.log('正在预处理音频(16kHz 单声道)...')
    const preparedAudio = await prepareMono16kWav(args.file)

    try {
      this.log('正在转写, 请耐心等待...')
      const transcription = await client.transcribe({audioPath: preparedAudio.wavPath, modelId: flags.model, language: flags.language})

      if (flags.out === undefined) {
        this.log('')
        this.log(transcription.text)
        return
      }
      writeFileSync(flags.out, transcription.text, 'utf8')
      this.log(`已写入: ${flags.out}`)
    } finally {
      await preparedAudio.cleanup()
    }
  }
}
