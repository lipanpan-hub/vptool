import {readFile} from 'node:fs/promises'

/**
 * /v1/models 列表项
 */
export interface ModelInfo {
  id: string
  family: string
  task: string
  mode: string
  loaded: boolean
  path: string
}

/**
 * /v1/audio/alignments 的词级时间戳项(单位: 秒)
 */
export interface AlignedWord {
  word: string
  start: number
  end: number
  start_sample: number
  end_sample: number
  confidence: number
}

/**
 * /v1/audio/transcriptions 响应
 */
export interface TranscriptionResult {
  text: string
  timing: {
    audio_duration_ms: number
    rtf: number
    wall_ms: number
  }
}

/**
 * /v1/audio/alignments 响应
 */
export interface AlignmentResult {
  text: string
  language: string
  words: AlignedWord[]
  timing: {
    audio_duration_ms: number
    rtf: number
    wall_ms: number
  }
}

/**
 * /v1/models/load 请求体
 */
export interface LoadModelRequest {
  id: string
  path: string
  family: string
  task?: string
  session_options?: Record<string, string>
}

/**
 * 客户端构造选项
 */
export interface AudioCppClientOptions {
  // 服务地址, 如 http://127.0.0.1:8080
  baseUrl: string
  // 请求超时毫秒数(模型推理较慢, 默认 10 分钟)
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 600_000

/**
 * 服务端错误响应体结构
 */
interface ErrorResponse {
  error?: {
    message?: string
  }
}

/**
 * audiocpp_server HTTP API 客户端(门面模式):
 * 将模型管理、转写、对齐、语音合成等端点收敛为单一入口,
 * 命令层只关心业务参数, 不感知 multipart/JSON 的组装细节。
 */
export class AudioCppClient {
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(options: AudioCppClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  // #region 模型管理

  /**
   * 列出服务端已注册的模型及其加载状态。
   */
  async listModels(): Promise<ModelInfo[]> {
    const payload = await this.requestJson<{data: ModelInfo[]}>('GET', '/v1/models')
    return payload.data
  }

  /**
   * 装载模型。
   */
  async loadModel(request: LoadModelRequest): Promise<{id: string, loaded: boolean, reconfigured: boolean}> {
    return this.requestJson('POST', '/v1/models/load', JSON.stringify(request), {
      'Content-Type': 'application/json',
    })
  }

  /**
   * 卸载模型释放显存。
   */
  async unloadModel(modelId: string): Promise<void> {
    await this.requestJson('POST', '/v1/models/unload', JSON.stringify({id: modelId}), {
      'Content-Type': 'application/json',
    })
  }

  /**
   * 校验指定模型已加载, 未注册或未加载时抛出带指引的错误。
   */
  async ensureModelLoaded(modelId: string, usageHint: string): Promise<void> {
    const models = await this.listModels()
    const target = models.find((model) => model.id === modelId)

    if (target === undefined) {
      throw new Error(`模型未注册: ${modelId}, 请先执行: vp auc load <模型目录>`)
    }
    if (!target.loaded) {
      throw new Error(`模型未加载: ${modelId}, ${usageHint}`)
    }
  }

  // #endregion

  // #region 语音转写与对齐

  /**
   * 语音转文字(纯文本, 不含时间戳)。
   */
  async transcribe(request: {audioPath: string, language: string; modelId: string,}): Promise<TranscriptionResult> {
    // Blob 入参用 Uint8Array 包装, 规避 Buffer 的 ArrayBufferLike 兼容问题
    const audioBytes = new Uint8Array(await readFile(request.audioPath))
    const form = new FormData()
    form.append('file', new Blob([audioBytes], {type: 'audio/wav'}), 'audio.wav')
    form.append('model', request.modelId)
    form.append('language', request.language)
    return this.requestJson('POST', '/v1/audio/transcriptions', form)
  }

  /**
   * 强制对齐: 按已知文本给出词级时间戳(要求音频为 16kHz 单声道)。
   */
  async align(request: {audioPath: string, language: string; modelId: string, text: string,}): Promise<AlignmentResult> {
    const audioBytes = new Uint8Array(await readFile(request.audioPath))
    const form = new FormData()
    form.append('file', new Blob([audioBytes], {type: 'audio/wav'}), 'audio.wav')
    form.append('model', request.modelId)
    form.append('text', request.text)
    form.append('language', request.language)
    return this.requestJson('POST', '/v1/audio/alignments', form)
  }

  // #endregion

  // #region 语音合成与音色

  /**
   * 文本合成语音, 返回音频二进制。
   */
  async synthesizeSpeech(request: {
    language: string
    modelId: string
    // 音频格式, 默认 wav
    responseFormat: string
    text: string
    // 服务内置音色名(可选, 未指定参考音色时使用)
    voiceName?: string
    // 参考音色 wav 文件路径(可选)
    voiceRefPath?: string
  }): Promise<Buffer> {
    const body: Record<string, unknown> = {
      model: request.modelId,
      input: request.text,
      language: request.language,
      // 服务端字段为 snake_case, 无法改名
      // eslint-disable-next-line camelcase
      response_format: request.responseFormat,
    }
    if (request.voiceRefPath !== undefined) {
      // 服务端字段为 snake_case, 无法改名
      // eslint-disable-next-line camelcase
      body.voice_ref = request.voiceRefPath
    } else if (request.voiceName !== undefined) {
      body.voice = request.voiceName
    }

    const response = await this.doFetch('POST', '/v1/audio/speech', JSON.stringify(body), {
      'Content-Type': 'application/json',
    })
    if (!response.ok) {
      throw new Error(`语音合成失败 (${response.status}): ${await response.text()}`)
    }
    return Buffer.from(await response.arrayBuffer())
  }

  /**
   * 列出共享参考音色库中的音色名。
   */
  async listVoices(modelId: string): Promise<string[]> {
    const payload = await this.requestJson<{voices: string[]}>("GET", `/v1/audio/voices?model=${encodeURIComponent(modelId)}`)
    return payload.voices
  }

  // #endregion

  // #region 底层请求

  private async doFetch(method: string, path: string, body?: FormData | string, headers: Record<string, string> = {}): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method,
      body,
      headers,
      signal: AbortSignal.timeout(this.timeoutMs),
    })
  }

  // 统一发起请求并解析 JSON, 非 2xx 时提取服务端 error.message 抛出
  private async requestJson<T>(method: string, path: string, body?: FormData | string, headers: Record<string, string> = {}): Promise<T> {
    const response = await this.doFetch(method, path, body, headers)
    const rawText = await response.text()

    if (!response.ok) {
      let errorMessage = rawText
      try {
        const errorPayload = JSON.parse(rawText) as ErrorResponse
        if (errorPayload.error?.message !== undefined) {
          errorMessage = errorPayload.error.message
        }
      } catch {
        // 响应不是 JSON, 保留原文
      }
      throw new Error(`audiocpp 请求失败 (${response.status}): ${errorMessage}`)
    }

    return JSON.parse(rawText) as T
  }

  // #endregion
}
