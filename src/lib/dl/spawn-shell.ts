import {spawn} from 'node:child_process'

export function spawnShellAt(cwd: string): Promise<number> {
  // 根据平台选择交互式 shell,优先使用用户环境变量指定的 shell
  let command: string
  if (process.platform === 'win32') {
    command = process.env.ComSpec || 'cmd.exe'
  } else {
    command = process.env.SHELL || '/bin/bash'
  }

  // stdio: inherit 让新 shell 接管当前终端的输入输出,cwd 设为目标目录
  // 用户退出该 shell(exit)后回到原处,Promise 在子进程结束时 resolve
  return new Promise((resolve, reject) => {
    const child = spawn(command, [], {cwd, stdio: 'inherit'})
    child.on('error', reject)
    child.on('exit', (code) => resolve(code ?? 0))
  })
}
