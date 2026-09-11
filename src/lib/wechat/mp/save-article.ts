import {mkdirSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

import type {ParsedArticle} from './provider.js'

// 存放所有公众号文章的顶层文件夹名(在 documentsPath 之下), 导出以供打开目录命令复用
export const ROOT_FOLDER = '1111微信公众号'

// 清洗字符串使其可安全作为文件名/文件夹名: 替换非法字符、折叠空白并限制长度
function sanitizeName(name: string): string {
  const cleaned = name
    .replaceAll(/[\\/:*?"<>|\n\r\t]/g, '_')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
    .trim()
  return cleaned || '未命名'
}

// 从 "2025-03-05 12:22" 形式的发布时间中提取日期部分 "2025-03-05"
function extractDate(createTime: string): string {
  // 以空格分隔取首段即日期; 缺失时降级为空字符串, 交由调用方兜底
  const datePart = (createTime || '').split(' ')[0] ?? ''
  return sanitizeName(datePart)
}

/**
 * 将解析后的文章保存为本地 txt 文件。
 *
 * 目录结构: <documentsPath>/1111微信公众号/<公众号昵称>/<日期 标题>.txt
 *
 * @param article - 解析后的文章数据
 * @param documentsPath - 配置中的工作目录根路径
 * @returns 保存后的完整文件路径
 */
export function saveArticle(article: ParsedArticle, documentsPath: string): string {
  const dir = join(documentsPath, ROOT_FOLDER, sanitizeName(article.nickName))
  mkdirSync(dir, {recursive: true})

  const datePart = extractDate(article.createTime)
  const fileName = `${sanitizeName(`${datePart} ${article.title}`)}.txt`
  const filePath = join(dir, fileName)

  writeFileSync(filePath, article.contentText, 'utf8')
  return filePath
}
