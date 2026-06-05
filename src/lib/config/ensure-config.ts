import {existsSync, mkdirSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

/**
 * 确保配置文件存在,如果不存在则创建默认配置文件
 * @param configDir - 配置目录路径
 * @param documentsDir - 文档目录路径,用于写入配置文件
 */
export function ensureConfigFile(configDir: string, documentsDir: string): void {
  const configPath = join(configDir, 'config.yml')
  
  if (existsSync(configPath)) {
    return
  }
  try {
    // 确保配置目录存在
    if (!existsSync(configDir)) {
      mkdirSync(configDir, {recursive: true})
    }
    
    // 创建默认配置内容
    const defaultConfig = `# vptool 配置文件
documentsDir: ${documentsDir}
`
    
    writeFileSync(configPath, defaultConfig, 'utf-8')
    process.stdout.write(`已创建默认配置文件: ${configPath}\n`)
  } catch (error) {
    process.stderr.write(`创建配置文件失败: ${error}\n`)
  }
}
