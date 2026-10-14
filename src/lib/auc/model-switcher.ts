import prompts from 'prompts'

import type {AudioCppClient, LoadModelRequest} from './audiocpp-client.js'
import {listModelCandidates, locateAlignerPackage, type ModelCandidate} from './model-locator.js'

export interface ReplaceLoadedModelsOptions {
  audioCppDir: string
  client: AudioCppClient
  // 进度输出回调(命令层传 this.log)
  log: (message: string) => void
  target: ModelCandidate
}

/**
 * 模型切换器(门面模式): 将「卸载全部已加载 + 装载目标」的换装流程
 * 收敛为单一入口, 供 vp auc use 与 vp auc start --model 复用,
 * 保证两条命令的切换语义完全一致。
 */
export async function replaceLoadedModels(options: ReplaceLoadedModelsOptions): Promise<void> {
  const loadedModels = (await options.client.listModels()).filter((model) => model.loaded)

  // #region 幂等短路: 目标权重已在装载中则跳过换装
  // 按权重路径精确匹配而非 family/task: IndexTTS2 与 2.5 的 family 同为 index_tts2,
  // 按 family 判断会把「切换 TTS 变体」误判为已装载
  const isTargetAlreadyLoaded = loadedModels.some((model) => isSameModelPath(model.path, options.target.weightsPath))
  if (isTargetAlreadyLoaded) {
    options.log(`目标模型已装载, 无需换装: ${options.target.family} (${basenameOf(options.target.weightsPath)})`)
    return
  }
  // #endregion

  // #region 卸载全部已加载模型(显存有限, 切换即换装)
  if (loadedModels.length === 0) {
    options.log('当前没有已加载的模型')
  }
  for (const loadedModel of loadedModels) {
    // eslint-disable-next-line no-await-in-loop -- 逐个卸载需按服务端顺序确认
    await options.client.unloadModel(loadedModel.id)
    options.log(`已卸载: ${loadedModel.id} (task=${loadedModel.task})`)
  }
  // #endregion

  // #region 装载目标模型; ASR 场景伴随装载对齐模型
  // qwen3_asr 的逐词时间戳依赖独立对齐模型, 沿用服务包内既有脚本的 session_options 模式
  const isAsrTarget = options.target.task === 'asr'
  const alignerPackage = isAsrTarget ? locateAlignerPackage(options.audioCppDir) : null

  const loadRequest: LoadModelRequest = {
    id: options.target.family,
    path: options.target.weightsPath,
    family: options.target.family,
    task: options.target.task,
    // 服务端字段为 snake_case, 无法改名
    // eslint-disable-next-line camelcase
    session_options: (isAsrTarget && (alignerPackage !== null))
      ? {[`${options.target.family}.forced_aligner_model_path`]: alignerPackage.weightsPath}
      : undefined,
  }

  options.log(`正在装载: id=${loadRequest.id} task=${loadRequest.task} path=${loadRequest.path}`)
  await options.client.loadModel(loadRequest)

  if (isAsrTarget && (alignerPackage !== null)) {
    options.log(`正在装载对齐模型: id=${alignerPackage.spec.family} path=${alignerPackage.weightsPath}`)
    await options.client.loadModel({
      id: alignerPackage.spec.family,
      path: alignerPackage.weightsPath,
      family: alignerPackage.spec.family,
      task: alignerPackage.spec.tasks[0],
    })
  } else if (isAsrTarget) {
    options.log('未找到对齐模型包, 已跳过(vp auc sub 需要对齐模型, 请用 vp auc load 单独装载)')
  }
  // #endregion

  // #region 输出切换后的装载清单
  const loadedAfterSwitch = (await options.client.listModels()).filter((model) => model.loaded)
  options.log(`当前已加载 ${loadedAfterSwitch.length} 个模型:`)
  for (const model of loadedAfterSwitch) {
    options.log(`  - ${model.id} (task=${model.task})`)
  }
  // #endregion
}

// 路径等价判断: 统一正斜杠 + 小写(Windows 路径大小写不敏感)
function isSameModelPath(left: string, right: string): boolean {
  return left.replaceAll('\\', '/').toLowerCase() === right.replaceAll('\\', '/').toLowerCase()
}

// 取路径的最后一段(兼容 / 与 \ 分隔)
function basenameOf(pathValue: string): string {
  return pathValue.split(/[\\/]/).pop() ?? pathValue
}

// 交互式列出 models 下全部可装载模型供用户选择(use/start 共用)
export async function selectModelInteractively(audioCppDir: string): Promise<ModelCandidate> {
  const candidates = listModelCandidates(audioCppDir)
  if (candidates.length === 0) {
    throw new Error(`models 目录下没有可装载的模型包: ${audioCppDir}`)
  }

  const response = await prompts({
    type: 'select',
    name: 'candidateIndex',
    message: '请选择要加载的模型:',
    choices: candidates.map((candidate) => ({
      // 包元数据里的权重 key 可能带子目录前缀, 展示取文件名
      title: `${candidate.family} [${candidate.task}] (${candidate.directoryName}/${basenameOf(candidate.weightFileName)})`,
      value: candidate,
    })),
  })

  if (response.candidateIndex === undefined) {
    throw new Error('未选择模型, 已取消')
  }
  return response.candidateIndex as ModelCandidate
}
