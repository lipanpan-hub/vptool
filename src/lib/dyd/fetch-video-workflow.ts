import {join} from 'node:path'

import type {DouyinProvider, ResolvedInput} from './provider.js'

import {readDocumentsDir} from '../config/read-config.js'
import {selectPrefix} from '../dl/select-prefix.js'
import {downloadDouyinVideo} from './download-douyin.js'
import {ensureTikhubToken} from './ensure-token.js'
import {resolveInput} from './resolve-input.js'
import {selectProvider} from './select-provider.js'
import {findProvider} from './tikhub-providers.js'

interface Logger {
  log: (message: string) => void
}

export interface FetchVideoOptions {
  keepAudio: boolean
  output?: string
  provider?: string
}

// 门面模式(Facade): 将 token 获取、输入解析、接口选择、下载抽音等子系统
// 统一封装到高层入口 execute() 之后, 命令层只与本门面交互, 无需了解内部编排细节
export class FetchVideoWorkflow {
  constructor(
    private readonly rawInput: string,
    private readonly options: FetchVideoOptions,
    private readonly configDir: string,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<void> {
    const token = await this.resolveToken()
    const input = await this.resolveInput()
    const provider = await this.chooseProvider()
    await this.download(provider, input, token)
    this.logger.log('\n✅ 下载完成!')
  }

  private async chooseProvider(): Promise<DouyinProvider> {
    // 带 --provider 只走指定接口, 失败即报错; 否则进入交互式选择菜单
    return this.options.provider ? findProvider(this.options.provider)! : selectProvider()
  }

  private async download(provider: DouyinProvider, input: ResolvedInput, token: string): Promise<void> {
    const baseOutputDir = this.options.output || readDocumentsDir(this.configDir) || '.'
    const prefix = await selectPrefix(this.configDir)
    const outputBaseDir = join(baseOutputDir, prefix)
    await downloadDouyinVideo(provider, input, {extractAudio: this.options.keepAudio, outputBaseDir, token}, this.logger)
  }

  private async resolveInput(): Promise<ResolvedInput> {
    this.logger.log(`正在解析输入: ${this.rawInput}\n`)
    const input = await resolveInput(this.rawInput)
    this.logger.log(`✓ 视频 ID: ${input.awemeId}\n`)
    return input
  }

  private async resolveToken(): Promise<string> {
    return ensureTikhubToken(this.configDir)
  }
}
