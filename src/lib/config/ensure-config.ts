import {existsSync, mkdirSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

import {ensureDocumentsDir} from './ensure-documents-dir.js'

/**
 * 确保配置文件存在,如果不存在则创建默认配置文件
 * @param configDir - 配置目录路径
 * @returns 完整的 config.yml 文件路径
 */
export function ensureConfigFile(configDir: string): string {
  const configPath = join(configDir, 'config.yml')
  
  if (existsSync(configPath)) {
    return configPath
  }
  try {
    // 确保配置目录存在
    if (!existsSync(configDir)) {
      mkdirSync(configDir, {recursive: true})
    }
    
    // 获取 documents 目录路径
    const documentsDir = ensureDocumentsDir()
    console.log(documentsDir)
    
    // 创建默认配置内容
    const defaultConfig = `# vptool 配置文件
documentsPath: ${documentsDir}
`
    
    writeFileSync(configPath, defaultConfig, 'utf-8')
    process.stdout.write(`已创建默认配置文件: ${configPath}\n`)
  } catch (error) {
    process.stderr.write(`创建配置文件失败: ${error}\n`)
  }

  return configPath
}
