import {execFileSync, spawn} from 'node:child_process'
import {existsSync, mkdirSync, openSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

/**
 * audiocpp_server 的健康检查响应结构
 */
interface HealthResponse {
  status: string
  backend: string
  models: number
}

/**
 * 正在监听服务端口的进程信息
 */
export interface ListeningProcess {
  processId: number
  name: string
  // 可执行文件路径, 权限不足时可能缺失
  path?: string
  commandLine?: string
  // 连接状态(Listen / Bound / Established 等)
  state?: string
}

/**
 * PowerShell 探测脚本输出的 JSON 结构
 */
interface PortProbeResult {
  found: boolean
  pid?: number
  name?: string
  path?: null | string
  commandLine?: null | string
  state?: string
}

/**
 * 服务管理器构造选项
 */
export interface ServerManagerOptions {
  // audiocpp 包所在目录(即 audiocpp_server.exe 与 models 的父目录)
  audioCppDir: string
  // 服务监听端口
  port: number
  // 计算后端(如 cuda / cpu), 仅启动服务时需要
  backend?: string
}

/**
 * start() 的执行结果
 */
export type ServerStartResult = {
  health: HealthResponse
  kind: 'already-running'
} | {
  health: HealthResponse
  kind: 'started'
}

/**
 * stop() 的执行结果
 */
export type ServerStopResult = {
  kind: 'not-running'
} | {
  kind: 'stopped'
  processId: number
  processName: string
}

// 服务可执行文件名
const SERVER_EXE_NAME = 'audiocpp_server.exe'
// 服务固定监听本机回环地址
const SERVER_HOST = '127.0.0.1'
// 启动后等待就绪的超时时间(GPU 模型服务初始化较慢)
const READY_TIMEOUT_MS = 60_000
// 健康检查轮询间隔
const POLL_INTERVAL_MS = 700
// 停止服务时等待进程退出的超时时间
const STOP_TIMEOUT_MS = 15_000
// 进程名关键词, 用于防止误杀恰好占用同一端口的其他程序
const SERVER_PROCESS_NAME_KEYWORD = 'audiocpp'

/**
 * audiocpp_server 服务生命周期管理器(门面模式):
 * 将健康探测、后台启动、停止三类操作封装为单一入口, 命令层只负责参数解析与结果输出。
 * 启动语义沿用 audiocpp 包内既有脚本: detached 后台进程, 日志落盘到包目录 testmp/ 下。
 */
export class AudioCppServerManager {
  private readonly audioCppDir: string
  private readonly port: number
  private readonly backend: string | undefined
  // 子进程提前退出时的退出码, 未退出为 undefined
  private serverExitCode: number | undefined

  constructor(options: ServerManagerOptions) {
    this.audioCppDir = options.audioCppDir
    this.port = options.port
    this.backend = options.backend
  }

  // #region 路径与地址

  get serverExePath(): string {
    return join(this.audioCppDir, SERVER_EXE_NAME)
  }

  get baseUrl(): string {
    return `http://${SERVER_HOST}:${this.port}`
  }

  get logFilePath(): string {
    return join(this.audioCppDir, 'testmp', 'server.log')
  }

  get errorLogFilePath(): string {
    return join(this.audioCppDir, 'testmp', 'server.err.log')
  }

  // #endregion

  // #region 启动服务

  /**
   * 校验服务可执行文件存在, 不存在时抛出带指引的错误。
   */
  checkPrerequisites(): void {
    if (!existsSync(this.serverExePath)) {
      throw new Error(`找不到 ${SERVER_EXE_NAME}: ${this.serverExePath}`)
    }
    // 日志目录不存在时创建, 保证 spawn 重定向的文件句柄可打开
    mkdirSync(join(this.audioCppDir, 'testmp'), {recursive: true})
  }

  /**
   * 启动服务: 已在运行则直接返回现有健康状态, 否则后台拉起进程并等待就绪。
   */
  async start(): Promise<ServerStartResult> {
    const existingHealth = await this.fetchHealth()
    if (existingHealth !== null) {
      return {kind: 'already-running', health: existingHealth}
    }

    this.spawnServerProcess()
    const health = await this.waitUntilReady()
    return {kind: 'started', health}
  }

  // 以 detached 后台进程方式拉起 server, 标准输出/错误重定向到日志文件
  private spawnServerProcess(): void {
    const stdoutFd = openSync(this.logFilePath, 'a')
    const stderrFd = openSync(this.errorLogFilePath, 'a')
    // backend 仅在传入时追加, stop 场景不会走到 spawn
    const backendArguments = this.backend ? ['--backend', this.backend] : []
    const serverArguments = [
      '--ui',
      '--ui-management',
      '--host', SERVER_HOST,
      '--port', String(this.port),
      ...backendArguments,
    ]
    const child = spawn(this.serverExePath, serverArguments, {
      // cwd 必须是包目录, server 按相对路径查找 models 等资源
      cwd: this.audioCppDir,
      detached: true,
      windowsHide: true,
      stdio: ['ignore', stdoutFd, stderrFd],
    })
    // 记录子进程提前退出的退出码, 供就绪轮询时快速失败
    this.serverExitCode = undefined
    child.on('exit', (exitCode) => {
      this.serverExitCode = exitCode ?? -1
    })
    child.unref()
  }

  // 读取 stderr 日志末尾若干行, 用于启动失败时直接展示原因
  private readErrorLogTail(lineCount = 5): string {
    try {
      const errorLines = readFileSync(this.errorLogFilePath, 'utf8').split('\n').filter((line) => line.trim() !== '')
      return errorLines.slice(-lineCount).join('\n')
    } catch {
      return ''
    }
  }

  // #endregion

  // #region 停止服务(仅支持 Windows, 依赖 Get-NetTCPConnection 定位进程)

  /**
   * 停止服务: 按监听端口定位进程并强制终止, 轮询确认已退出。
   */
  async stop(): Promise<ServerStopResult> {
    const listeningProcess = this.findListeningProcess()
    if (listeningProcess === null) {
      return {kind: 'not-running'}
    }
    // 防止误杀恰好占用同一端口的其他程序
    if (!listeningProcess.name.toLowerCase().includes(SERVER_PROCESS_NAME_KEYWORD)) {
      throw new Error(`端口 ${this.port} 被其他进程占用: ${listeningProcess.name} (pid=${listeningProcess.processId})`)
    }

    this.terminateProcess(listeningProcess.processId)
    if (!(await this.waitUntilStopped())) {
      throw new Error(`服务在 ${STOP_TIMEOUT_MS / 1000} 秒内未关闭, 可手动执行: taskkill /F /PID ${listeningProcess.processId}`)
    }
    return {kind: 'stopped', processId: listeningProcess.processId, processName: listeningProcess.name}
  }

  // 找监听服务端口的属主进程(仅 Listen 状态), stop 用
  private findListeningProcess(): ListeningProcess | null {
    return this.probePortProcess(true)
  }

  // 找以任意状态占用该端口的进程(含仅 bind 未 listen 的情况), 供启动前冲突检测; 排除 pid 0(TIME_WAIT 残留)
  findPortOccupier(): ListeningProcess | null {
    return this.probePortProcess(false)
  }

  // 用 Get-NetTCPConnection 找到端口的属主进程, 省去解析 netstat 文本
  private probePortProcess(isListenOnly: boolean): ListeningProcess | null {
    const stateFilter = isListenOnly ? '-State Listen ' : ''
    const probeScript = [
      `$conn = Get-NetTCPConnection -LocalPort ${this.port} ${stateFilter}-ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 0 } | Select-Object -First 1`,
      '$result = [ordered]@{ found = $false }',
      [
        'if ($null -ne $conn) {',
        '$proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue;',
        '$cim = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $conn.OwningProcess) -ErrorAction SilentlyContinue;',
        '$result = [ordered]@{ found = $true; pid = $conn.OwningProcess; name = $proc.ProcessName; path = $proc.Path; commandLine = $cim.CommandLine; state = [string]$conn.State }',
        '}',
      ].join(' '),
      '$result | ConvertTo-Json -Compress',
    ].join('; ')

    let output: string
    try {
      output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', probeScript], {encoding: 'utf8'})
    } catch {
      return null
    }

    let probeResult: PortProbeResult
    try {
      probeResult = JSON.parse(output.trim()) as PortProbeResult
    } catch {
      return null
    }
    if (!probeResult.found) {
      return null
    }
    return {
      processId: Number(probeResult.pid),
      name: String(probeResult.name),
      path: probeResult.path ?? undefined,
      commandLine: probeResult.commandLine ?? undefined,
      state: probeResult.state,
    }
  }

  /**
   * 强制终止占用端口的进程并等待端口释放, 超时抛错(启动前冲突处理用)。
   */
  async killPortOccupier(occupier: ListeningProcess): Promise<void> {
    this.terminateProcess(occupier.processId)
    if (!(await this.waitUntilStopped(false))) {
      throw new Error(`端口 ${this.port} 在 ${STOP_TIMEOUT_MS / 1000} 秒内未释放, 可手动执行: taskkill /F /PID ${occupier.processId}`)
    }
  }

  private terminateProcess(processId: number): void {
    try {
      execFileSync('taskkill', ['/PID', String(processId), '/F'], {encoding: 'utf8'})
    } catch {
      // 进程可能已自行退出, 交由后续轮询确认
    }
  }

  // isListenOnly 决定"端口已释放"的判定口径: stop 只看 Listen, 冲突处理看任意状态
  private async waitUntilStopped(isListenOnly = true): Promise<boolean> {
    const stopDeadline = Date.now() + STOP_TIMEOUT_MS
    while (Date.now() < stopDeadline) {
      if (this.probePortProcess(isListenOnly) === null) {
        return true
      }
      // eslint-disable-next-line no-await-in-loop -- 轮询场景必须串行等待
      await delay(POLL_INTERVAL_MS)
    }
    return false
  }

  // #endregion

  // #region 健康检查

  /**
   * 探测服务健康状态, 服务未就绪/不可达时返回 null。
   */
  async fetchHealth(): Promise<HealthResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {signal: AbortSignal.timeout(3000)})
      if (!response.ok) {
        return null
      }
      const health = (await response.json()) as HealthResponse
      return (health.status === 'ok') ? health : null
    } catch {
      return null
    }
  }

  // 轮询健康检查直到服务就绪或超时
  private async waitUntilReady(): Promise<HealthResponse> {
    const readyDeadline = Date.now() + READY_TIMEOUT_MS
    while (Date.now() < readyDeadline) {
      // eslint-disable-next-line no-await-in-loop -- 轮询场景必须串行等待
      const health = await this.fetchHealth()
      if (health !== null) {
        return health
      }
      if (this.serverExitCode !== undefined) {
        throw new Error(`服务进程已提前退出(退出码 ${this.serverExitCode}), stderr 末尾:\n${this.readErrorLogTail()}\n完整日志: ${this.errorLogFilePath}`)
      }
      // eslint-disable-next-line no-await-in-loop -- 轮询场景必须串行等待
      await delay(POLL_INTERVAL_MS)
    }
    throw new Error(`服务在 ${READY_TIMEOUT_MS / 1000} 秒内未就绪, 详见日志: ${this.logFilePath}`)
  }

  // #endregion
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}
