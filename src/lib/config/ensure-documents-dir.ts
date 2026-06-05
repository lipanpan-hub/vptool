import {execSync} from 'node:child_process'
import {existsSync, mkdirSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'

/**
 * 确保 vptool 工作目录存在,如果不存在则创建
 * Windows 系统会尝试获取真实的 Documents 路径(支持用户重定向)
 * Linux/macOS 系统使用 ~/Documents 路径
 */
export function ensureDocumentsDir(): string {
  // 获取用户 Documents 目录路径
  let documentsPath: string
  
  if (process.platform === 'win32') {
    // Windows 系统使用 PowerShell 获取真实的 Documents 路径,支持用户重定向
    try {
      const result = execSync('powershell -command "[Environment]::GetFolderPath(\'MyDocuments\')"', {
        encoding: 'utf-8',
      })
      documentsPath = result.trim()
    } catch {
      // 降级方案: 使用默认路径
      documentsPath = join(process.env.USERPROFILE || homedir(), 'Documents')
    }
  } else {
    // Linux/macOS 系统
    documentsPath = join(homedir(), 'Documents')
  }
  
  const vptoolPath = join(documentsPath, 'vptool')
  
  // 检查 vptool 目录是否存在,不存在则创建
  if (!existsSync(vptoolPath)) {
    try {
      mkdirSync(vptoolPath, {recursive: true})
      process.stdout.write(`已创建配置目录: ${vptoolPath}\n`)
    } catch (error) {
      process.stderr.write(`创建配置目录失败: ${error}\n`)
    }
  }
  
  return vptoolPath
}
