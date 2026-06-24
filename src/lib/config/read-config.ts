import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {parse, stringify} from 'yaml'

export function readDocumentsDir(configDir: string): string | null {
  const configPath = join(configDir, 'config.yml')
  
  if (!existsSync(configPath)) {
    return null
  }
  
  try {
    const configContent = readFileSync(configPath, 'utf-8')
    const config = parse(configContent) as Record<string, any>
    
    return config?.documentsPath || null
  } catch {
    return null
  }
}

export function readDlPrefix(configDir: string): string[] {
  const configPath = join(configDir, 'config.yml')
  if (!existsSync(configPath)) return []
  try {
    const config = parse(readFileSync(configPath, 'utf-8')) as Record<string, any>
    return Array.isArray(config?.dl_prefix) ? config.dl_prefix : []
  } catch {
    return []
  }
}

export function addDlPrefix(configDir: string, prefix: string): void {
  const configPath = join(configDir, 'config.yml')
  if (!existsSync(configPath)) return
  try {
    const config = (parse(readFileSync(configPath, 'utf-8')) as Record<string, any>) || {}
    const list: string[] = Array.isArray(config.dl_prefix) ? config.dl_prefix : []
    if (!list.includes(prefix)) {
      list.push(prefix)
      config.dl_prefix = list
      writeFileSync(configPath, stringify(config), 'utf-8')
    }
  } catch {
    // 写入失败时静默忽略, 不影响下载主流程
  }
}
