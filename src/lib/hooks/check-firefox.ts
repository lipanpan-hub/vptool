import {execSync} from 'node:child_process'
import {existsSync} from 'node:fs'

// 检测系统是否安装了火狐浏览器
export function checkFirefoxInstalled(): boolean {
  try {
    if (process.platform === 'win32') {
      // Windows: 检查常见的火狐安装路径和注册表
      const commonPaths = [
        'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
        'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
      ]
      
      // 先检查文件是否存在
      for (const path of commonPaths) {
        if (existsSync(path)) {
          return true
        }
      }
      
      // 尝试通过 where 命令查找
      execSync('where firefox', {stdio: 'ignore'})
      return true
    } else if (process.platform === 'darwin') {
      // macOS: 检查 Applications 目录
      if (existsSync('/Applications/Firefox.app')) {
        return true
      }
      execSync('which firefox', {stdio: 'ignore'})
      return true
    } else {
      // Linux: 使用 which 命令
      execSync('which firefox', {stdio: 'ignore'})
      return true
    }
  } catch {
    return false
  }
}
