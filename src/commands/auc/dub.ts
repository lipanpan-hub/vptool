import {Args, Flags} from '@oclif/core'
import {existsSync, mkdirSync} from 'node:fs'
import {resolve} from 'node:path'

import {AudioCppClient} from '../../lib/auc/audiocpp-client.js'
import {AudioCppServerManager} from '../../lib/auc/audiocpp-server-manager.js'
import {IndexTtsDubPipeline} from '../../lib/auc/dub-pipeline.js'
import {findIndexTts25Candidate} from '../../lib/auc/model-locator.js'
import {replaceLoadedModels} from '../../lib/auc/model-switcher.js'
import {BaseCommand} from '../../lib/base-command.js'
import {ToolConfigManager} from '../../lib/config/index.js'
import {selectFile} from '../../lib/vtt/select-file.js'

export default class AucDub extends BaseCommand {
  static description = '为 VTT 字幕逐条配音并按时间轴拼接成完整配音音轨(本地 IndexTTS2.5): 自动确保服务已启动(未启动则拉起), 且装载的是 IndexTTS2.5(不是则卸载其他模型后换装); 单条配音超出字幕时长时拼接用 ffmpeg atempo 变速不变调(最高 3 倍), 仍超出则截断; 单条合成失败即中止, 重跑凭缓存续跑'

  static examples = [
    '<%= config.bin %> <%= command.id %> "video.zh.vtt"',
    '<%= config.bin %> <%= command.id %> "video.zh.vtt" --voice demo_3_woman',
    '<%= config.bin %> <%= command.id %> video.zh.vtt -r me.wav --outdir out',
  ]

  static args = {
    vtt: Args.string({description: 'VTT 字幕文件路径(省略则交互选择当前目录 .vtt)', required: false}),
  }

  static flags = {
    backend: Flags.string({description: '计算后端(仅服务未启动需要拉起时生效)', default: 'cuda'}),
    language: Flags.string({description: '配音文本语言', default: 'zh'}),
    outdir: Flags.string({char: 'o', description: '输出目录, 省略时输出到字幕所在目录'}),
    port: Flags.integer({description: '服务监听端口(需与启动时一致)', default: 8080}),
    'reference-text': Flags.string({description: '参考音频里说的文字, 仅配合 --voice-ref 使用, 可省略'}),
    voice: Flags.string({description: '服务内置音色名(可用 vp auc voices 查询); 指定 --voice-ref 时忽略', default: 'demo_1_man'}),
    'voice-ref': Flags.string({char: 'r', description: '参考音频 wav 路径, 克隆其音色, 优先于 --voice'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(AucDub)

    // #region 确定输入字幕与输出参数
    const vttPath = args.vtt ?? (await selectFile(['.vtt'], '请选择要配音的 VTT 字幕文件:'))
    if (!existsSync(vttPath)) this.error(`文件不存在: ${vttPath}`)
    if ((flags['voice-ref'] !== undefined) && !existsSync(flags['voice-ref'])) {
      this.error(`参考音频不存在: ${flags['voice-ref']} (voice-ref 只支持 wav 文件路径)`)
    }
    if (flags.outdir !== undefined) mkdirSync(flags.outdir, {recursive: true})
    // #endregion

    // #region 确保服务可用: 未启动则后台拉起并等待就绪, 已启动则复用
    const audioCppDir = ToolConfigManager.fromConfigDir(this.config.configDir).getAudioCppDir()
    if (audioCppDir === null) {
      this.error('未配置 audiocpp 目录, 请先执行: vp auc cfset <audiocpp目录>')
    }
    const resolvedAudioCppDir = resolve(audioCppDir)
    const manager = new AudioCppServerManager({audioCppDir: resolvedAudioCppDir, port: flags.port, backend: flags.backend})
    try {
      manager.checkPrerequisites()
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error))
    }

    const startResult = await manager.start()
    if (startResult.kind === 'already-running') {
      this.log(`服务已在运行, 复用现有进程: ${manager.baseUrl}`)
    } else {
      this.log(`服务已启动: backend=${startResult.health.backend}, 地址: ${manager.baseUrl}`)
    }
    // #endregion

    // #region 确保装载的是 IndexTTS2.5: 不是则卸载全部已加载模型后换装(目标已装载则跳过)
    let targetModel
    try {
      targetModel = findIndexTts25Candidate(resolvedAudioCppDir)
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error))
    }
    this.log(`目标模型: ${targetModel.directoryName}/${targetModel.weightFileName}`)

    const client = new AudioCppClient({baseUrl: manager.baseUrl})
    await replaceLoadedModels({audioCppDir: resolvedAudioCppDir, client, log: (message) => this.log(message), target: targetModel})
    // #endregion

    // #region 执行配音
    const pipeline = new IndexTtsDubPipeline({
      client,
      language: flags.language,
      log: (message) => this.log(message),
      modelId: targetModel.family,
      referenceText: flags['reference-text'],
      voiceName: flags.voice,
      // 服务端按路径读取参考音频, 必须用绝对路径
      voiceRefPath: (flags['voice-ref'] === undefined) ? undefined : resolve(flags['voice-ref']).replaceAll('\\', '/'),
    })
    this.log(`输入: ${vttPath}`)
    this.log('开始配音...')

    const result = await pipeline.dub(vttPath, flags.outdir)
    this.log(`\n完成, 完整配音: ${result.wavPath}`)
    this.log(`单条配音缓存(断点续跑): ${result.cacheDir}`)
    // #endregion
  }
}
