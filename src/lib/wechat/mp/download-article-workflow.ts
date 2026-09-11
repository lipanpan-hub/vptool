import type {WechatArticleProvider} from './provider.js'

import {ToolConfigManager} from '../../config/index.js'
import {ensureTikhubToken} from '../../dyd/ensure-token.js'
import {saveArticle} from './save-article.js'
import {selectProvider} from './select-provider.js'
import {findProvider, providers} from './tikhub-providers.js'

interface Logger {
  log: (message: string) => void
}

export interface DownloadArticleOptions {
  output?: string
  provider?: string
}

// 门面模式(Facade): 将 token 获取、接口选择、文章解析、保存等子系统
// 统一封装到高层入口 execute() 之后, 命令层只与本门面交互, 无需了解内部编排细节
export class DownloadArticleWorkflow {
  constructor(
    private readonly articleUrl: string,
    private readonly options: DownloadArticleOptions,
    private readonly configDir: string,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<void> {
    const token = await ensureTikhubToken(this.configDir)
    const provider = await this.chooseProvider()

    this.logger.log(`\n正在使用接口 [${provider.id}] 解析文章...`)
    const article = await provider.fetchArticle(this.articleUrl, token)
    this.logger.log(`✓ 公众号: ${article.nickName} | 标题: ${article.title}\n`)

    const documentsPath = this.options.output || ToolConfigManager.fromConfigDir(this.configDir).getDocumentsPath()
    const filePath = saveArticle(article, documentsPath)
    this.logger.log(`✅ 文章已保存: ${filePath}`)
  }

  private async chooseProvider(): Promise<WechatArticleProvider> {
    // 指定 --provider 走指定接口; 只有一个接口时直接使用; 存在多个时进入交互式选择
    if (this.options.provider) return findProvider(this.options.provider)!
    if (providers.length === 1) return providers[0]
    return selectProvider()
  }
}
