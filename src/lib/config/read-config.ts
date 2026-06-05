import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {parse} from 'yaml'

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
