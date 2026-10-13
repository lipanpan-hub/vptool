/**
 * /v1/status 响应
 */
export interface BiliupStatus {
  version: string
  config: Record<string, unknown>
  rooms: unknown[]
  download_semaphore: number
  update_semaphore: number
}

/**
 * /v1/me 响应: 当前调用者的身份与权限
 */
export interface BiliupMe {
  auth_enabled: boolean
  fleet_controller: boolean
  id: string | null
  role: string
  username: string | null
  permissions: string[]
}

/**
 * /v1/streamers 列表项: 数据库行字段平铺 + 运行时状态
 */
export interface BiliupStreamer {
  id: number
  url: string
  remark: string
  filename_prefix: string | null
  time_range: string | null
  format: string | null
  // 运行时状态(Idle/Working/...), 未运行时为空串
  status: string
  upload_status: string
  live_bytes_per_sec: number | null
  live_cover_url: string | null
  live_avatar_url: string | null
  session_id: number | null
  [key: string]: unknown
}

/**
 * /v1/system-stats 响应
 */
export interface BiliupSystemStats {
  ts: number
  interval_ms: number
  history_ms: number
  cpu: {
    logical: number
    physical: number
  }
  memory: {
    limited: boolean
    total: number
    used: number
  }
  disk: {
    available: number
    path: string
    total: number
    used: number
  }
  interfaces: string[]
  samples: {
    cpu: number
    rx: number
    ts: number
    tx: number
  }[]
}

/**
 * /v1/sessions 列表项(录制场次, 时间戳为毫秒)
 */
export interface BiliupSession {
  id: number
  url: string
  streamer_id: number | null
  started_at: number | null
  ended_at: number | null
  [key: string]: unknown
}

/**
 * /v1/sessions 分页响应
 */
export interface BiliupSessionPage {
  items: BiliupSession[]
  total: number
  page: number
  page_size: number
}

/**
 * /v1/videos 列表项(录制产出文件, 字段以服务端为准)
 */
export interface BiliupVideo {
  id: number
  [key: string]: unknown
}

/**
 * /v1/publish-jobs 响应
 */
export interface BiliupPublishJobs {
  paused: boolean | null
  jobs: unknown[]
}

/**
 * POST /v1/streamers 请求体(必填 url/remark, 其余交由服务端默认)
 */
export interface BiliupAddStreamerRequest {
  url: string
  remark: string
  filename_prefix?: string | null
}

/**
 * 客户端构造选项
 */
export interface BiliupClientOptions {
  // 服务地址, 如 http://127.0.0.1:19159
  baseUrl: string
  // 请求超时毫秒数
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 15_000

// biliup server 默认监听端口(与 biliup server --help 的默认值一致)
export const BILIUP_DEFAULT_PORT = 19_159
// biliup server 默认绑定地址
export const BILIUP_DEFAULT_BIND = '127.0.0.1'

/**
 * 按端口与绑定地址构造客户端, 供各命令层复用。
 */
export function createBiliupClient(port: number, bind: string): BiliupClient {
  return new BiliupClient({baseUrl: `http://${bind}:${port}`})
}

/**
 * 将毫秒时间戳格式化为本地时间文本, 空值显示 '-'。
 */
export function formatTimestamp(milliseconds: number | null): string {
  if (milliseconds === null || milliseconds === undefined) {
    return '-'
  }
  return new Date(milliseconds).toLocaleString('zh-CN', {hour12: false})
}

/**
 * biliup server HTTP API 客户端(门面模式):
 * 将状态查询、主播管理、系统监控等端点收敛为单一入口,
 * 命令层只关心业务参数, 不感知 HTTP 细节。
 */
export class BiliupClient {
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(options: BiliupClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  // #region 状态与身份

  /**
   * 服务概览: 版本、房间数、并发与录制配置。
   */
  async getStatus(): Promise<BiliupStatus> {
    return this.requestJson('GET', '/v1/status')
  }

  /**
   * 当前调用者身份与权限(未开认证时为匿名管理员)。
   */
  async getMe(): Promise<BiliupMe> {
    return this.requestJson('GET', '/v1/me')
  }

  /**
   * 系统资源快照: CPU/内存/磁盘/网速采样。
   */
  async getSystemStats(): Promise<BiliupSystemStats> {
    return this.requestJson('GET', '/v1/system-stats')
  }

  // #endregion

  // #region 主播(录制目标)管理

  /**
   * 列出全部监控主播及其运行状态。
   */
  async listStreamers(): Promise<BiliupStreamer[]> {
    return this.requestJson('GET', '/v1/streamers')
  }

  /**
   * 添加监控主播。
   */
  async addStreamer(request: BiliupAddStreamerRequest): Promise<BiliupStreamer> {
    return this.requestJson('POST', '/v1/streamers', JSON.stringify(request))
  }

  /**
   * 删除监控主播。
   */
  async deleteStreamer(id: number): Promise<void> {
    await this.requestJson('DELETE', `/v1/streamers/${id}`)
  }

  /**
   * 切换主播暂停状态(toggle 语义: 暂停中则恢复, 否则暂停)。
   */
  async togglePause(id: number): Promise<void> {
    await this.requestJson('PUT', `/v1/streamers/${id}/pause`)
  }

  // #endregion

  // #region 场次与产出

  /**
   * 分页列出录制场次。
   */
  async listSessions(page: number, pageSize: number): Promise<BiliupSessionPage> {
    const query = `page=${page}&page_size=${pageSize}`
    return this.requestJson('GET', `/v1/sessions?${query}`)
  }

  /**
   * 列出录制产出的视频文件。
   */
  async listVideos(): Promise<BiliupVideo[]> {
    return this.requestJson('GET', '/v1/videos')
  }

  /**
   * 查看投稿发布队列。
   */
  async listPublishJobs(): Promise<BiliupPublishJobs> {
    return this.requestJson('GET', '/v1/publish-jobs')
  }

  // #endregion

  /**
   * 统一 JSON 请求: 网络层失败抛出带指引的错误, HTTP 层失败抛出服务端错误信息。
   */
  private async requestJson<T>(method: string, path: string, body?: string): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: (body === undefined) ? {} : {'Content-Type': 'application/json'},
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch {
      throw new Error(`无法连接 biliup 服务 (${this.baseUrl}), 请先执行: vp bup server`)
    }

    const rawText = await response.text()
    if (!response.ok) {
      throw new Error(`biliup 请求失败 (${response.status}): ${rawText}`)
    }
    // 204 等空响应体直接返回 null, 交由调用方类型约定处理
    if (rawText === '') {
      return null as T
    }
    return JSON.parse(rawText) as T
  }
}

/**
 * 从宽松结构的对象中按候选字段名顺序取第一个非空字符串值(服务端字段未定时兜底展示)。
 */
export function pickText(record: Record<string, unknown>, candidateKeys: string[]): string {
  for (const candidateKey of candidateKeys) {
    const value = record[candidateKey]
    if (typeof value === 'string' && value !== '') {
      return value
    }
    if (typeof value === 'number') {
      return String(value)
    }
  }
  return '-'
}

/**
 * 合并录制/上传状态为一行人话: 录制中的附带实时码率(列表与交互选择共用)。
 */
export function formatStreamerStatus(streamer: BiliupStreamer): string {
  const parts: string[] = []
  const recordingStatus = (streamer.status === '') ? '空闲' : streamer.status
  parts.push(`录制 ${recordingStatus}`)
  if (streamer.live_bytes_per_sec !== null && streamer.live_bytes_per_sec !== undefined) {
    parts.push(`${(streamer.live_bytes_per_sec / (1024 * 1024)).toFixed(2)} MiB/s`)
  }
  const uploadStatus = (streamer.upload_status === '') ? '空闲' : streamer.upload_status
  parts.push(`上传 ${uploadStatus}`)
  return parts.join(' | ')
}
