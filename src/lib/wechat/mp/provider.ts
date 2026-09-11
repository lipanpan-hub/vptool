// 解析出的文章信息, 供保存器使用
export interface ParsedArticle {
  // 正文纯文本, 写入 txt 文件的内容
  contentText: string
  // 发布时间, 形如 "2025-03-05 12:22"
  createTime: string
  // 公众号昵称, 作为子文件夹名
  nickName: string
  // 文章标题, 作为文件名一部分
  title: string
}

// 文章解析接口(策略). 每个平台的解析 API 封装为一个 provider,
// 工作流仅依赖此抽象, 从而实现依赖注入与接口可插拔
export interface WechatArticleProvider {
  fetchArticle(articleUrl: string, token: string): Promise<ParsedArticle>
  id: string
  title: string
}
