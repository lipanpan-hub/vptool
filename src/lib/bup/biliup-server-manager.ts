import {execFileSync, spawn} from 'node:child_process'
import {existsSync, mkdirSync, openSync} from 'node:fs'
import {join} from 'node:path'

/**
 * 正在监听服务端口的进程信息
 */
interface ListeningProcess {
  processId: number
  name: string
}

/**
 * PowerShell 探测脚本输出的 JSON 结构
 */
interface PortProbeResult {
  found: boolean
  pid?: number
  name?: string
}

/**
 * 服务管理器构造选项
 */
export interface BiliupServerManagerOptions {
  // biliupR 包所在目录(即 biliup.exe 的父目录, 同时也是服务的工作目录)
  biliupRDir: string
  // 服务监听端口
  port: number
  // 服务绑定地址
  bind: string
}

/**
 * start() 的执行结果
 */
export type BiliupServerStartResult = {
  kind: 'already-running'
} | {
  kind: 'started'
}

// 服务可执行文件名
const SERVER_EXE_NAME = 'biliup.exe'
// 启动后等待就绪的超时时间(web 服务启动较快, 预留余量即可)
const READY_TIMEOUT_MS = 30_000
// 就绪探测轮询间隔
const POLL_INTERVAL_MS = 500
// 进程名关键词, 用于区分端口属主是否为 biliup
const SERVER_PROCESS_NAME_KEYWORD = 'biliup'

/**
 * biliup server 生命周期管理器(门面模式):
 * 将端口探测、后台启动封装为单一入口, 命令层只负责参数解析与结果输出。
 * 启动语义与 vp auc start 一致: detached 后台进程, 日志落盘到包目录 testmp/ 下。
 */
export class BiliupServerManager {
  private readonly biliupRDir: string
  private readonly port: number
  private readonly bind: string

  constructor(options: BiliupServerManagerOptions) {
    this.biliupRDir = options.biliupRDir
    this.port = options.port
    this.bind = options.bind
  }

  // #region 路径与地址

  get serverExePath(): string {
    return join(this.biliupRDir, SERVER_EXE_NAME)
  }

  get baseUrl(): string {
    return `http://${this.bind}:${this.port}`
  }

  get logFilePath(): string {
    return join(this.biliupRDir, 'testmp', 'server.log')
  }

  get errorLogFilePath(): string {
    return join(this.biliupRDir, 'testmp', 'server.err.log')
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
    mkdirSync(join(this.biliupRDir, 'testmp'), {recursive: true})
  }

  /**
   * 启动服务: 端口已被 biliup 监听则直接复用, 否则后台拉起进程并等待就绪。
   */
  async start(): Promise<BiliupServerStartResult> {
    // #region 端口归属判定
    // 先查端口属主, 被非 biliup 进程占用时明确报错, 避免把其他 HTTP 服务误判为已在运行
    const listeningProcess = this.findListeningProcess()
    if (listeningProcess !== null && !this.isOwnedByBiliup(listeningProcess.name)) {
      throw new Error(`端口 ${this.port} 被其他进程占用: ${listeningProcess.name} (pid=${listeningProcess.processId})`)
    }
    // #endregion

    // #region 复用或拉起
    if (listeningProcess !== null) {
      // 端口已被 biliup 监听: 服务可能在启动中, 等待 HTTP 可达后复用
      await this.waitUntilReady()
      return {kind: 'already-running'}
    }
    if (await this.isServiceAlive()) {
      // 端口查不到属主但有 HTTP 响应(权限等边缘情况), 保守复用不重复拉起
      return {kind: 'already-running'}
    }

    this.spawnServerProcess()
    await this.waitUntilReady()
    return {kind: 'started'}
    // #endregion
  }

  // 以 detached 后台进程方式拉起 server, 标准输出/错误重定向到日志文件
  private spawnServerProcess(): void {
    const stdoutFd = openSync(this.logFilePath, 'a')
    const stderrFd = openSync(this.errorLogFilePath, 'a')
    const serverArguments = [
      'server',
      '--bind', this.bind,
      '--port', String(this.port),
    ]
    const child = spawn(this.serverExePath, serverArguments, {
      // cwd 决定服务工作目录: cookies.json、data/ 均按相对路径落在此处
      cwd: this.biliupRDir,
      detached: true,
      windowsHide: true,
      stdio: ['ignore', stdoutFd, stderrFd],
    })
    child.unref()
  }

  // #endregion

  // #region 就绪探测

  /**
   * 探测服务是否存活: 根路径收到任意 HTTP 响应(含 30x/40x)即视为 biliup 已就绪。
   */
  private async isServiceAlive(): Promise<boolean> {
    try {
      await fetch(this.baseUrl, {signal: AbortSignal.timeout(3000)})
      return true
    } catch {
      return false
    }
  }

  // 轮询就绪探测直到服务响应或超时
  private async waitUntilReady(): Promise<void> {
    const readyDeadline = Date.now() + READY_TIMEOUT_MS
    while (Date.now() < readyDeadline) {
      // eslint-disable-next-line no-await-in-loop -- 轮询场景必须串行等待
      if (await this.isServiceAlive()) {
        return
      }
      // eslint-disable-next-line no-await-in-loop -- 轮询场景必须串行等待
      await delay(POLL_INTERVAL_MS)
    }
    throw new Error(`服务在 ${READY_TIMEOUT_MS / 1000} 秒内未就绪, 详见日志: ${this.logFilePath}`)
  }

  // 用 Get-NetTCPConnection 找到监听服务端口的属主进程, 省去解析 netstat 文本
  private findListeningProcess(): ListeningProcess | null {
    const probeScript = [
      `$conn = Get-NetTCPConnection -LocalPort ${this.port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1`,
      '$result = [ordered]@{ found = $false }',
      'if ($null -ne $conn) { $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue; $result = [ordered]@{ found = $true; pid = $conn.OwningProcess; name = $proc.ProcessName } }',
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
    // fetch 有响应但端口查不到属主(权限等边缘情况), 视为 biliup 自身, 不阻塞启动判断
    if (probeResult.pid === undefined || probeResult.name === undefined) {
      return null
    }
    return {processId: Number(probeResult.pid), name: String(probeResult.name)}
  }

  // 判断端口属主进程是否为 biliup
  private isOwnedByBiliup(processName: string): boolean {
    return processName.toLowerCase().includes(SERVER_PROCESS_NAME_KEYWORD)
  }

  // #endregion
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}
