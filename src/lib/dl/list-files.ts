import {readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'

export interface FileEntry {
  depth: number
  isDir: boolean
  name: string
  size: number
}

export function listFiles(dir: string): FileEntry[] {
  // 递归遍历目录,目录在前文件在后,各自按名称排序
  const result: FileEntry[] = []

  function walk(current: string, depth: number): void {
    const entries = readdirSync(current, {withFileTypes: true}).sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    for (const entry of entries) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        result.push({depth, isDir: true, name: entry.name, size: 0})
        walk(fullPath, depth + 1)
      } else {
        result.push({depth, isDir: false, name: entry.name, size: statSync(fullPath).size})
      }
    }
  }

  walk(dir, 0)
  return result
}

export function formatSize(bytes: number): string {
  // 按字节大小自动选择合适单位
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let i = 0
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }

  return `${i === 0 ? size : size.toFixed(2)} ${units[i]}`
}
