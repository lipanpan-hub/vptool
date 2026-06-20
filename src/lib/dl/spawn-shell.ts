import {spawn} from 'node:child_process'

export function spawnShellAt(cwd: string): Promise<number> {
  // 根据平台选择交互式 shell,优先使用用户环境变量指定的 shell
  // Windows 下 cmd 默认代码页非 UTF-8,中文路径/文件名会乱码
  // 用 /K chcp 65001 在保持交互的同时切到 UTF-8
  let command: string
  let args: string[] = []
  if (process.platform === 'win32') {
    command = process.env.ComSpec || 'cmd.exe'
    args = ['/K', 'chcp 65001 >nul']
  } else {
    command = process.env.SHELL || '/bin/bash'
  }

  // chcp 65001 只改控制台代码页(影响 dir 等原生命令)
  // 而 GNU 工具(如 git 自带的 ls.exe)看 LANG/LC_ALL,locale 非 UTF-8 时会把中文字节转义成乱码
  // 故注入 UTF-8 locale,让两类程序都能正常显示中文
  const env = {...process.env, LANG: 'zh_CN.UTF-8', LC_ALL: 'zh_CN.UTF-8'}

  // stdio: inherit 让新 shell 接管当前终端的输入输出,cwd 设为目标目录
  // 用户退出该 shell(exit)后回到原处,Promise 在子进程结束时 resolve
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd, env, stdio: 'inherit'})
    child.on('error', reject)
    child.on('exit', (code) => resolve(code ?? 0))
  })
}
