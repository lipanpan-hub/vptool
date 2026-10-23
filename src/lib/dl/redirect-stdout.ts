// 启用时把 process.stdout.write 转写到 stderr, 用来拦截第三方库(如 ytdlp-nodejs 的 console.log/进度条)对 stdout 的直接写入
export async function withStdoutToStderr<T>(isEnabled: boolean, task: () => Promise<T>): Promise<T> {
  if (!isEnabled) {
    return task()
  }

  const originalWrite = process.stdout.write
  process.stdout.write = process.stderr.write.bind(process.stderr) as typeof process.stdout.write
  try {
    return await task()
  } finally {
    // 必须还原, 否则 oclif 之后输出结果 JSON 会被写到 stderr
    process.stdout.write = originalWrite
  }
}
