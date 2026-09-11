// 这个命令的作用是下载 微信公众号的文章 为本地txt文档 
// 用户只需要提供 微信公众号文章连接 
// 拿到微信公众号 文章连接后 如果只有一个provider接口则直接使用 如果存在多个provider的多个解析接口 则让用户交互式选择 
// 默认使用 tikhub 的 微信公众号 解析接口  POST https://api.tikhub.io/api/v1/wechat_mp/v2/fetch_article_detail_h5
// 这个接口返回的结果 示例 E:\Desktop\vptool\src\commands\wechat\mp\demo.json
// 获取 配置文件当中 documentsPath 查看下面 是否存在  “1111微信公众号” 文件夹  如果没有则创建
// 获取 data.nick_name 作为子文件夹名字  在 “1111微信公众号” 文件夹 下面创建子文件夹 如果已经存在就不用创建了 
// 然后保存文章 成为 txt文件 文件名字是 data.create_time 中的日期 加上  data.title 
// 文章内容是  data.content_text 

import {Args, Command, Flags} from '@oclif/core'

import {DownloadArticleWorkflow} from '../../../lib/wechat/mp/download-article-workflow.js'
import {providers} from '../../../lib/wechat/mp/tikhub-providers.js'

export default class WechatMpDl extends Command {
  static aliases = ['wx:mp:dl','mp:dl']
  static args = {
    url: Args.string({description: '微信公众号文章链接', required: true}),
  }
  static description = '下载微信公众号文章为本地 txt 文档(通过 TikHub 接口)'
  static examples = [
    '<%= config.bin %> <%= command.id %> https://mp.weixin.qq.com/s/xxxxxxx',
    '<%= config.bin %> <%= command.id %> https://mp.weixin.qq.com/s/xxxxxxx --provider tikhub-h5',
  ]
  static flags = {
    output: Flags.string({
      char: 'o',
      description: '输出目录(默认为配置文件中的 documentsPath)',
    }),
    provider: Flags.string({
      char: 'p',
      description: '指定解析接口(不指定则在存在多个接口时进入交互式选择菜单)',
      options: providers.map((p) => p.id),
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(WechatMpDl)

    try {
      // 命令层只负责组装参数并委托给门面, 具体编排见 DownloadArticleWorkflow
      const workflow = new DownloadArticleWorkflow(
        args.url,
        {output: flags.output, provider: flags.provider},
        this.config.configDir,
        this,
      )
      await workflow.execute()
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error))
    }
  }
}
