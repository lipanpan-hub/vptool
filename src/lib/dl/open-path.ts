import {spawn} from 'node:child_process'

export function openPath(targetPath: string): void {
  // 根据平台选择对应的打开命令
  let command: string
  let args: string[]

  if (process.platform === 'win32') {
    // Windows: 通过 cmd 的 start 调用默认程序,首个空字符串参数占位窗口标题
    command = 'cmd'
    args = ['/c', 'start', '', targetPath]
  } else if (process.platform === 'darwin') {
    command = 'open'
    args = [targetPath]
  } else {
    command = 'xdg-open'
    args = [targetPath]
  }

  // detached + unref 让子进程独立运行,不阻塞 CLI 退出
  const child = spawn(command, args, {detached: true, stdio: 'ignore'})
  child.unref()
}
