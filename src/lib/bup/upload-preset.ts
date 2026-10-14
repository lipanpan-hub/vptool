/**
 * upload 投稿参数预设的持久化:
 * 每次投稿把最终生效的视频路径与参数快照覆盖写入当前目录固定文件(bup-upload.yml),
 * 下次经 --from-yaml 导入跳过重复输入。来源优先级: 命令行 > 预设 > 交互询问。
 */
import {existsSync, readFileSync, writeFileSync} from 'node:fs'

import {parse, stringify} from 'yaml'

import {type BupUploadFlagsSnapshot, type BupUploadOptions} from './interactive.js'

// 预设固定文件名, 保存于运行命令时的当前目录
export const UPLOAD_PRESET_FILENAME = 'bup-upload.yml'

/** 预设文件结构: 视频绝对路径列表 + 投稿参数快照(未提供的键不落盘) */
export interface UploadPreset {
  files: string[]
  uploadOptions: BupUploadFlagsSnapshot
}

/** 保存预设(整体覆盖写入) */
export function saveUploadPreset(presetPath: string, files: string[], options: BupUploadOptions): void {
  const preset: UploadPreset = {files, uploadOptions: omitNullish(options)}
  writeFileSync(presetPath, stringify(preset), 'utf8')
}

/** 读取预设, 文件不存在或内容非对象时抛错(命令层转 this.error) */
export function loadUploadPreset(presetPath: string): UploadPreset {
  if (!existsSync(presetPath)) {
    throw new Error(`预设文件不存在: ${presetPath}`)
  }
  const parsed = parse(readFileSync(presetPath, 'utf8')) as UploadPreset | null
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(`预设文件格式不正确: ${presetPath}`)
  }
  // 手改 yaml 留空的键会解析为 null, 统一剔除使其回退到交互询问
  return {files: parsed.files ?? [], uploadOptions: omitNullish(parsed.uploadOptions ?? {})}
}

/**
 * 三级来源合并: 位置参数优先于预设视频列表(都缺省则交给交互选择);
 * 命令行已传 flag 覆盖预设同名值, 未传(undefined)沿用预设。
 */
export function mergeUploadSources(cliFiles: string[], cliFlags: BupUploadFlagsSnapshot, preset: UploadPreset | undefined): {files: string[], flags: BupUploadFlagsSnapshot} {
  if (preset === undefined) {
    return {files: cliFiles, flags: cliFlags}
  }
  return {
    files: cliFiles.length > 0 ? cliFiles : preset.files,
    flags: {...preset.uploadOptions, ...omitNullish(cliFlags)},
  }
}

// 剔除值为 undefined/null 的键(未传项不覆盖预设、不落盘冗余、null 回退交互)
function omitNullish<T extends object>(source: T): Partial<T> {
  const result: Partial<T> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && value !== null) {
      ;(result as Record<string, unknown>)[key] = value
    }
  }
  return result
}
