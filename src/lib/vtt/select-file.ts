import Fuse from 'fuse.js'
import {existsSync, readdirSync} from 'node:fs'
import {join, relative} from 'node:path'
import prompts from 'prompts'

// 候选文件条目: title 用于菜单展示, value 为可直接传给外部命令的路径
interface FileChoice {
  title: string
  value: string
}

// 扫描目录条目: label 用于候选展示时标注来源, path 为被扫描的目录
export interface FileScanDir {
  label: string
  path: string
}

/** 必选: 从当前目录按扩展名筛选文件供模糊搜索选择, 无候选或未选中时报错 */
export async function selectFile(extensions: string[], message: string): Promise<string> {
  const selected = await pickFileFromCwd(extensions, message, false)
  return selected as string
}

/** 可跳过: 首项为跳过哨兵(空输入回车即命中), 返回 undefined 表示不指定文件 */
export async function selectOptionalFile(extensions: string[], message: string): Promise<string | undefined> {
  const selected = await pickFileFromCwd(extensions, message, true)
  return selected === '' ? undefined : selected
}

/** 必选: 扫描多个目录合并候选并标注来源, 无候选或未选中时报错 */
export async function selectFileFromDirs(
  scanDirs: readonly FileScanDir[],
  extensions: string[],
  message: string,
): Promise<string> {
  const fileChoices = listChoicesFromDirs(scanDirs, extensions)
  if (fileChoices.length === 0) {
    const dirPaths = scanDirs.map((scanDir) => scanDir.path).join(', ')
    throw new Error(`以下目录均未找到 ${extensions.join('/')} 文件: ${dirPaths}`)
  }

  const selected = await promptFileChoice(fileChoices, message)
  if (selected === undefined) {
    throw new Error('未选择文件')
  }
  return selected
}

/** 可跳过: 扫描多个目录合并候选并标注来源; 所有目录都没扫到候选时直接返回 undefined(不弹菜单, 调用方按跳过处理) */
export async function selectOptionalFileFromDirs(
  scanDirs: readonly FileScanDir[],
  extensions: string[],
  message: string,
): Promise<string | undefined> {
  const fileChoices = listChoicesFromDirs(scanDirs, extensions)
  if (fileChoices.length === 0) return undefined

  const choices = [{title: '(跳过, 不指定)', value: ''}, ...fileChoices]
  const selected = await promptFileChoice(choices, message)
  // 用户按 Esc 中断(undefined)与主动选跳过('')同样按不指定处理
  return selected === '' || selected === undefined ? undefined : selected
}

/** 交互选择骨架: 扫描当前目录 + prompts autocomplete; allowSkip 时首项插入跳过哨兵 */
async function pickFileFromCwd(extensions: string[], message: string, allowSkip: boolean): Promise<string | undefined> {
  const fileNames = readdirSync(process.cwd(), {withFileTypes: true})
    .filter((e) => e.isFile() && extensions.some((ext) => e.name.toLowerCase().endsWith(ext)))
    .map((e) => e.name)

  if (fileNames.length === 0 && !allowSkip) {
    throw new Error(`当前目录未找到 ${extensions.join('/')} 文件`)
  }

  const fileChoices = fileNames.map((name) => ({title: name, value: name}))
  const choices = allowSkip ? [{title: '(跳过, 不指定)', value: ''}, ...fileChoices] : fileChoices
  const selected = await promptFileChoice(choices, message)

  if (selected === undefined) {
    throw new Error('未选择文件')
  }
  return selected
}

// 遍历各扫描目录收集匹配扩展名的文件; value 用相对当前目录的路径(统一正斜杠), 便于直接拼进 mpv 等命令行
// 单独导出便于测试扫描逻辑
export function listChoicesFromDirs(scanDirs: readonly FileScanDir[], extensions: string[]): FileChoice[] {
  const choices: FileChoice[] = []
  for (const scanDir of scanDirs) {
    if (!existsSync(scanDir.path)) continue

    for (const entry of readdirSync(scanDir.path, {withFileTypes: true})) {
      const isTargetFile = entry.isFile() && extensions.some((ext) => entry.name.toLowerCase().endsWith(ext))
      if (!isTargetFile) continue

      const relativePath = relative(process.cwd(), join(scanDir.path, entry.name)).replaceAll('\\', '/')
      choices.push({title: `${entry.name} (${scanDir.label})`, value: relativePath})
    }
  }
  return choices
}

// fuse 仅索引真实候选, 输入过滤词后跳过哨兵自然被排除; 返回 undefined 表示用户按 Esc 中断
async function promptFileChoice(choices: FileChoice[], message: string): Promise<string | undefined> {
  const fuse = new Fuse(choices, {keys: ['title'], threshold: 0.3})
  const response = await prompts({
    choices,
    message,
    name: 'file',
    suggest: async (input: string, items: any[]) => {
      if (!input) return items
      return fuse.search(input).map((r) => r.item)
    },
    type: 'autocomplete',
  })
  return response.file
}
