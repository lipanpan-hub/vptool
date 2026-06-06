// 处理视频相关操作时的错误,返回格式化的错误消息
export function formatVideoError(
  error: unknown, 
  useCookies: boolean, 
  operation: 'fetch' | 'download' = 'fetch'
): string {
  const baseMessage = error instanceof Error ? error.message : String(error)
  const operationText = operation === 'fetch' ? '获取视频信息失败' : '下载失败'
  
  if (useCookies) {
    const tips = [
      '  1. 请确保 Firefox 浏览器已安装并已登录相关网站',
      '  2. 尝试先在 Firefox 中访问该视频，确保可以正常观看',
      '  3. 关闭 Firefox 浏览器后再试（某些系统可能需要）',
    ]
    
    if (operation === 'download') {
      tips.push('  4. 或使用 --no-use-cookies 跳过 cookies')
    }
    
    return `${operationText}: ${baseMessage}\n\n提示：\n${tips.join('\n')}`
  }

  return `${operationText}: ${baseMessage}`
}
