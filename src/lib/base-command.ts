import {Command} from '@oclif/core'
import {type Bindings, type Logger} from 'pino'

import {LoggerManager} from './logger/index.js'

// run() 的返回值会成为 --json 模式下信封的 data 字段;
// oclif 只在返回值为真值时才输出, 所以无数据的命令也要返回 {}, 由类型强制
export type CommandResult = object

// --json 成功信封
export interface JsonSuccessEnvelope {
  command: string | undefined
  data: CommandResult
  ok: true
}

// --json 失败信封(stdout 输出, 退出码非 0)
export interface JsonErrorEnvelope {
  command: string | undefined
  error: {code: string | undefined; exitCode: number | string | undefined; message: string}
  ok: false
}

export abstract class BaseCommand extends Command {
  // 所有命令统一支持 --json: 结果走 stdout 信封, this.log/this.warn 自动静默
  static enableJsonFlag = true

  // 子类直接用 this.logger 记日志, scope 自动带上命令 id
  protected logger!: Logger

  protected async catch(error: Error & {exitCode?: number}): Promise<unknown> {
    // this.logger?.error({err: error}, `命令执行失败: ${error.message}`)
    return super.catch(error)
  }

  // 命令内部需要更细粒度的 scope 时用它派生, 例如 this.createLogger('downloader')
  protected createLogger(scope: string, bindings: Bindings = {}): Logger {
    return LoggerManager.instance.createChildLogger(`${this.id ?? this.constructor.name}:${scope}`, bindings)
  }

  protected async finally(error: Error | undefined): Promise<unknown> {
    // 退出前必须等 transport worker 落盘, 否则短命进程会丢日志
    await LoggerManager.instance.shutdown()
    return super.finally(error)
  }

  // JSON 模式面向程序调用, 不能弹交互菜单; 需要交互时直接报错, 提示调用方补哪个参数
  protected rejectInteractionInJsonMode(requiredHint: string): void {
    if (this.jsonEnabled()) {
      this.error(`--json 模式下不能交互, 请显式传入: ${requiredHint}`)
    }
  }

  // 命令本身必须交互且没有参数可规避时用它, reason 说明交互点, 如 '起止时间只能交互输入'
  protected rejectInteractiveOnlyInJsonMode(reason: string): void {
    if (this.jsonEnabled()) {
      this.error(`该命令不支持 --json: ${reason}`)
    }
  }

  // 只挑 message/code/exitCode, 不展开整个 err, 避免带出体积大或有循环引用的内部字段
  protected toErrorJson(err: unknown): JsonErrorEnvelope {
    const error = err as {code?: string; exitCode?: number; message?: string}
    return {
      command: this.id,
      error: {
        code: error.code,
        // oclif 的 catch 在调用本方法前已设置 process.exitCode
        exitCode: process.exitCode,
        message: error.message ?? String(err),
      },
      ok: false,
    }
  }

  protected toSuccessJson(result: unknown): JsonSuccessEnvelope {
    return {command: this.id, data: result as CommandResult, ok: true}
  }

  async init(): Promise<void> {
    await super.init()

    // JSON 模式下关掉控制台 transport, 否则 pino-pretty 的日志会混进 stdout
    LoggerManager.instance.init(this.config.configDir, {isConsoleMuted: this.jsonEnabled()})
    this.logger = LoggerManager.instance.createChildLogger(this.id ?? this.constructor.name)
    this.logger.debug({argv: this.argv}, '命令开始执行')
  }

  abstract run(): Promise<CommandResult>
}
