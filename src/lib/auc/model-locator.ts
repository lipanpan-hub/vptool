import {existsSync, readdirSync, readFileSync} from 'node:fs'
import {basename, isAbsolute, join} from 'node:path'

/**
 * model_specs JSON 中命令层关心的字段
 */
export interface ModelSpecMeta {
  family: string
  tasks: string[]
  packages?: {default?: boolean, id: string, target_directory?: string}[]
}

/**
 * 定位完成的模型包信息(可直接转成 /v1/models/load 请求)
 */
export interface LocatedPackage {
  packageId: string
  spec: ModelSpecMeta
  weightsPath: string
}

/**
 * 可装载的模型候选(交互式选择列表项)
 */
export interface ModelCandidate {
  // models 下的包目录名
  directoryName: string
  packageId: string
  family: string
  task: string
  // 权重文件名(多精度目录用于区分候选)
  weightFileName: string
  weightsPath: string
}

/**
 * .audiocpp-package-<id>.json 的结构(本模块只关心 files 清单)
 */
interface PackageMeta {
  package_id: string
  files?: Record<string, {etag: string; size: number,}>
}

// 包元数据文件名前缀/后缀: .audiocpp-package-<packageId>.json
const PACKAGE_META_PREFIX = '.audiocpp-package-'
const PACKAGE_META_SUFFIX = '.json'

/**
 * 将命令传入的目录参数解析为绝对路径:
 * 绝对路径直接使用, 否则视为相对 audioCppDir/models 的包目录名。
 */
export function resolvePackageDir(audioCppDir: string, dirArgument: string): string {
  return isAbsolute(dirArgument) ? dirArgument : join(audioCppDir, 'models', dirArgument)
}

/**
 * 从模型包目录推导装载信息:
 * 目录内 .audiocpp-package-*.json 取包 id -> 匹配 model_specs 得 family/tasks -> 目录内唯一 .gguf 作权重。
 */
export function locatePackage(audioCppDir: string, packageDir: string, packageIdFlag?: string): LocatedPackage {
  // #region 定位包 id
  const packageIds = readdirSync(packageDir)
    .filter((fileName) => fileName.startsWith(PACKAGE_META_PREFIX) && fileName.endsWith(PACKAGE_META_SUFFIX))
    .map((fileName) => fileName.slice(PACKAGE_META_PREFIX.length, -PACKAGE_META_SUFFIX.length))

  if (packageIds.length === 0) {
    throw new Error(`目录内没有模型包元数据(.audiocpp-package-*.json): ${packageDir}`)
  }

  let packageId = packageIds[0]
  if (packageIds.length > 1) {
    if (packageIdFlag === undefined) {
      throw new Error(`目录内含多个包, 请用 --package 指定其一: ${packageIds.join(', ')}`)
    }
    if (!packageIds.includes(packageIdFlag)) {
      throw new Error(`--package=${packageIdFlag} 不在目录可用包列表中: ${packageIds.join(', ')}`)
    }
    packageId = packageIdFlag
  }
  // #endregion

  // #region 匹配 spec 获取 family/tasks
  const spec = findSpecByPackageId(audioCppDir, packageId)
  // #endregion

  // #region 定位 .gguf 权重
  const weightFileNames = readdirSync(packageDir).filter((fileName) => fileName.endsWith('.gguf'))
  if (weightFileNames.length === 0) {
    throw new Error(`目录内没有 .gguf 权重文件: ${packageDir}`)
  }
  if (weightFileNames.length > 1) {
    throw new Error(`目录内有多个精度权重, 无法自动选择: ${weightFileNames.join(', ')}`)
  }
  // #endregion

  return {
    packageId,
    spec,
    weightsPath: join(packageDir, weightFileNames[0]).replaceAll('\\', '/'),
  }
}

/**
 * 自动发现强制对齐模型包(供切换到 ASR 模型时伴随装载):
 * 扫描 model_specs 中 tasks 含 align 的 spec, 取其 target_directory 在 models 下实际存在的第一个。
 * 找不到时返回 null(调用方决定是否提示跳过)。
 */
export function locateAlignerPackage(audioCppDir: string): LocatedPackage | null {
  const specsDir = join(audioCppDir, 'model_specs')

  for (const spec of readAllSpecs(specsDir)) {
    if (!spec.tasks?.includes('align')) {
      continue
    }

    // 取 spec 声明的 target_directory(default 包优先), 在 models 下验证实际存在
    const candidateDirectories = (spec.packages ?? [])
      .sort((left, right) => Number(right.default ?? false) - Number(left.default ?? false))
      .map((pkg) => pkg.target_directory)
      .filter((directory): directory is string => directory !== undefined)

    for (const targetDirectory of candidateDirectories) {
      const packageDir = join(audioCppDir, 'models', targetDirectory)
      if (!existsSync(packageDir)) {
        continue
      }
      const weightFileNames = readdirSync(packageDir).filter((fileName) => fileName.endsWith('.gguf'))
      if (weightFileNames.length !== 1) {
        continue
      }
      return {
        packageId: '',
        spec,
        weightsPath: join(packageDir, weightFileNames[0]).replaceAll('\\', '/'),
      }
    }
  }
  return null
}

/**
 * 按目录参数直通定位模型候选: 目录名相对 models 或绝对路径均可,
 * 多包目录需 --package 指定包 id。
 */
export function selectModelByDirectory(audioCppDir: string, dirArgument: string, packageIdFlag?: string): ModelCandidate {
  const packageDir = resolvePackageDir(audioCppDir, dirArgument)
  const targetPackage = locatePackage(audioCppDir, packageDir, packageIdFlag)
  return {
    directoryName: basename(packageDir),
    packageId: targetPackage.packageId,
    family: targetPackage.spec.family,
    task: targetPackage.spec.tasks[0],
    weightFileName: basename(targetPackage.weightsPath),
    weightsPath: targetPackage.weightsPath,
  }
}

/**
 * 解析 --set key=value 形式的 session_options。
 */
export function parseSessionOptions(pairs: string[]): Record<string, string> {
  const sessionOptions: Record<string, string> = {}
  for (const pair of pairs) {
    const separatorIndex = pair.indexOf('=')
    if (separatorIndex <= 0) {
      throw new Error(`--set 期望 key=value 格式, 实际: ${pair}`)
    }
    sessionOptions[pair.slice(0, separatorIndex)] = pair.slice(separatorIndex + 1)
  }
  return sessionOptions
}

/**
 * 扫描 models 目录, 枚举全部可装载的模型候选:
 * 每个候选 = (包目录, 包, 权重) 三元组, family/task 由 spec 匹配得出。
 * 单个目录异常时跳过, 不中断整体扫描。
 */
export function listModelCandidates(audioCppDir: string): ModelCandidate[] {
  const modelsDir = join(audioCppDir, 'models')
  const candidates: ModelCandidate[] = []

  for (const directoryEntry of readdirSync(modelsDir, {withFileTypes: true})) {
    if (!directoryEntry.isDirectory()) {
      continue
    }

    // 目录级容错: 无包元数据或 spec 缺失的目录直接跳过
    let directoryCandidates: ModelCandidate[]
    try {
      directoryCandidates = listDirectoryCandidates(audioCppDir, join(modelsDir, directoryEntry.name), directoryEntry.name)
    } catch {
      continue
    }
    candidates.push(...directoryCandidates)
  }

  return candidates
}

// 枚举单个包目录下的全部(包, 权重)候选
function listDirectoryCandidates(audioCppDir: string, packageDir: string, directoryName: string): ModelCandidate[] {
  const packageIds = readdirSync(packageDir)
    .filter((fileName) => fileName.startsWith(PACKAGE_META_PREFIX) && fileName.endsWith(PACKAGE_META_SUFFIX))
    .map((fileName) => fileName.slice(PACKAGE_META_PREFIX.length, -PACKAGE_META_SUFFIX.length))

  const candidates: ModelCandidate[] = []
  for (const packageId of packageIds) {
    // spec 匹配失败的包(如未随包提供模型定义)跳过
    let spec: ModelSpecMeta
    try {
      spec = findSpecByPackageId(audioCppDir, packageId)
    } catch {
      continue
    }

    for (const weightKey of listPackageWeightFiles(packageDir, packageId)) {
      const weightsPath = resolveWeightPath(packageDir, weightKey)
      if (weightsPath === null) {
        continue
      }
      candidates.push({
        directoryName,
        packageId,
        family: spec.family,
        task: spec.tasks[0],
        weightFileName: weightKey,
        weightsPath,
      })
    }
  }
  return candidates
}

// 解析包声明的权重 key 为实际存在的路径:
// 不同包的 files key 语义不一致(有的相对包目录, 有的带包目录名前缀相对 models 根),
// 因此先按 key 直接拼, 不存在时回退按 basename 拼, 都不存在视为无效权重。
function resolveWeightPath(packageDir: string, weightKey: string): string | null {
  const directPath = join(packageDir, weightKey)
  if (existsSync(directPath)) {
    return directPath.replaceAll('\\', '/')
  }

  const fallbackPath = join(packageDir, basename(weightKey))
  if (existsSync(fallbackPath)) {
    return fallbackPath.replaceAll('\\', '/')
  }
  return null
}

// 枚举包自己声明的 .gguf 权重(优先取包元数据 files 清单, 避免多包目录交叉重复; 缺失时回退目录级枚举)
function listPackageWeightFiles(packageDir: string, packageId: string): string[] {
  try {
    const metaPath = join(packageDir, `${PACKAGE_META_PREFIX}${packageId}${PACKAGE_META_SUFFIX}`)
    const packageMeta = JSON.parse(readFileSync(metaPath, 'utf8')) as PackageMeta
    const declaredWeights = Object.keys(packageMeta.files ?? {}).filter((fileKey) => fileKey.endsWith('.gguf'))
    if (declaredWeights.length > 0) {
      return declaredWeights
    }
  } catch {
    // 元数据缺失或解析失败, 回退目录级枚举
  }
  return readdirSync(packageDir).filter((fileName) => fileName.endsWith('.gguf'))
}

// 扫描 model_specs/*.json, 找到 packages 中含目标包 id 的 spec
function findSpecByPackageId(audioCppDir: string, packageId: string): ModelSpecMeta {
  const specsDir = join(audioCppDir, 'model_specs')
  for (const spec of readAllSpecs(specsDir)) {
    if (spec.packages?.some((pkg) => pkg.id === packageId)) {
      return spec
    }
  }
  throw new Error(`在 model_specs 中找不到包 ${packageId} 对应的模型定义`)
}

// 读取 specs 目录下全部 spec, JSON 解析失败的文件跳过
function readAllSpecs(specsDir: string): ModelSpecMeta[] {
  const specs: ModelSpecMeta[] = []
  for (const specFileName of readdirSync(specsDir)) {
    if (!specFileName.endsWith('.json')) {
      continue
    }
    try {
      specs.push(JSON.parse(readFileSync(join(specsDir, specFileName), 'utf8')) as ModelSpecMeta)
    } catch {
      continue
    }
  }
  return specs
}
