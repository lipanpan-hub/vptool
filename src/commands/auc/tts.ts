import {Args, Flags} from '@oclif/core'
import {existsSync, writeFileSync} from 'node:fs'
import {resolve} from 'node:path'

import {BaseCommand} from '../../lib/base-command.js'
import {AudioCppClient} from '../../lib/auc/audiocpp-client.js'
import {ToolConfigManager} from '../../lib/config/index.js'

export default class AucTts extends BaseCommand {
  static description = '文字转语音(需已装载 TTS 模型, 可指定参考音色克隆音色)'

  static examples = [
    '<%= config.bin %> <%= command.id %> "你好, 世界"',
    '<%= config.bin %> <%= command.id %> "你好, 世界" --voice demo_1_man --out hello.wav',
  ]

  static args = {
    text: Args.string({description: '要合成的文本', required: true}),
  }

  static flags = {
    model: Flags.string({description: 'TTS 模型 id', default: 'index_tts2'}),
    language: Flags.string({description: '合成语言代码', default: 'zh'}),
    // 参考音色: wav 文件路径(服务端 voice_ref 仅支持文件)
    voice: Flags.string({description: '参考音色 wav 文件路径(音色克隆)'}),
    out: Flags.string({description: '音频输出路径', default: 'tts-output.wav'}),
    format: Flags.string({description: '音频格式', default: 'wav'}),
    port: Flags.integer({description: '服务监听端口(需与启动时一致)', default: 8080}),
  }

  public async run(): Promise<{outputPath: string; sizeBytes: number; voiceRefPath?: string}> {
    const {args, flags} = await this.parse(AucTts)

    const audioCppDir = ToolConfigManager.fromConfigDir(this.config.configDir).getAudioCppDir()
    if (audioCppDir === null) {
      this.error('未配置 audiocpp 目录, 请先执行: vp auc cfset <audiocpp目录>')
    }

    const client = new AudioCppClient({baseUrl: `http://127.0.0.1:${flags.port}`})
    await client.ensureModelLoaded(flags.model, '请先执行: vp auc load <模型目录> 或 vp auc models 查看状态')

    // #region 解析参考音色
    let voiceRefPath: string | undefined
    if (flags.voice !== undefined) {
      const candidatePath = resolve(flags.voice)
      if (!existsSync(candidatePath)) {
        this.error(`参考音色文件不存在: ${candidatePath} (voice 参数只支持 wav 文件路径)`)
      }
      voiceRefPath = candidatePath.replaceAll('\\', '/')
      this.log(`参考音色: ${voiceRefPath}`)
    }
    // #endregion

    this.log('正在合成语音, 请耐心等待...')
    const audioBytes = await client.synthesizeSpeech({
      modelId: flags.model,
      text: args.text,
      language: flags.language,
      voiceRefPath,
      responseFormat: flags.format,
    })

    writeFileSync(flags.out, audioBytes)
    this.log(`已生成语音(${Math.round(audioBytes.length / 1024)} KB): ${flags.out}`)

    return {outputPath: flags.out, sizeBytes: audioBytes.length, voiceRefPath}
  }
}
