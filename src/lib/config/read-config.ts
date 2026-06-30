/* eslint-disable camelcase */
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {parse, stringify} from 'yaml'

type ConfigRecord = Record<string, unknown>

export function readDocumentsDir(configDir: string): null | string {
  const configPath = join(configDir, 'config.yml')
  
  if (!existsSync(configPath)) {
    return null
  }
  
  try {
    const configContent = readFileSync(configPath, 'utf8')
    const config = parse(configContent) as ConfigRecord
    
    return typeof config?.documentsPath === 'string' ? config.documentsPath : null
  } catch {
    return null
  }
}

export function readDlPrefix(configDir: string): string[] {
  const configPath = join(configDir, 'config.yml')
  if (!existsSync(configPath)) return []
  try {
    const config = parse(readFileSync(configPath, 'utf8')) as ConfigRecord
    const dlPrefix = config?.dl_prefix
    return Array.isArray(dlPrefix) && dlPrefix.every((prefix) => typeof prefix === 'string') ? dlPrefix : []
  } catch {
    return []
  }
}

export function readTikHubToken(configDir: string): null | string {
  const configPath = join(configDir, 'config.yml')
  if (!existsSync(configPath)) return null
  try {
    const config = parse(readFileSync(configPath, 'utf8')) as ConfigRecord
    const token = config?.TIKHUB_IO_TOKEN
    return typeof token === 'string' && token.trim() ? token.trim() : null
  } catch {
    return null
  }
}

export function writeTikHubToken(configDir: string, token: string): void {
  const configPath = join(configDir, 'config.yml')
  if (!existsSync(configPath)) return
  const config = (parse(readFileSync(configPath, 'utf8')) as ConfigRecord) || {}
  config.TIKHUB_IO_TOKEN = token
  writeFileSync(configPath, stringify(config), 'utf8')
}

export function addDlPrefix(configDir: string, prefix: string): void {
  const configPath = join(configDir, 'config.yml')
  if (!existsSync(configPath)) return
  try {
    const config = (parse(readFileSync(configPath, 'utf8')) as ConfigRecord) || {}
    const dlPrefix = config.dl_prefix
    const list = Array.isArray(dlPrefix) && dlPrefix.every((item) => typeof item === 'string') ? dlPrefix : []
    if (!list.includes(prefix)) {
      list.push(prefix)
      config.dl_prefix = list
      writeFileSync(configPath, stringify(config), 'utf8')
    }
  } catch {
    // 写入失败时静默忽略, 不影响下载主流程
  }
}
