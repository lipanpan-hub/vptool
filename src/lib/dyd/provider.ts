// 解析出的视频信息, 供下载器使用
export interface ParsedVideo {
  awemeId: string
  desc: string
  videoUrl: string
}

// 解析后的用户输入: 兼具 aweme_id 与原始分享链接, 以适配不同参数类型的接口
export interface ResolvedInput {
  awemeId: string
  shareUrl: string
}

// 视频地址解析接口(策略). 每个 TikHub 接口封装为一个 provider,
// 下载器仅依赖此抽象, 从而实现依赖注入与接口可插拔
export interface DouyinProvider {
  fetchVideo(input: ResolvedInput, token: string): Promise<ParsedVideo>
  id: string
  title: string
}
