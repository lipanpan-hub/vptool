import prompts from 'prompts'

import {readTikhubToken, writeTikhubToken} from '../config/read-config.js'

export async function ensureTikhubToken(configDir: string): Promise<string> {
  const existing = readTikhubToken(configDir)
  if (existing) return existing

  // 配置缺失 TIKHUB_IO_TOKEN 时交互询问, 并写回配置文件供后续复用
  const {token} = await prompts({
    message: '未检测到 TIKHUB_IO_TOKEN, 请输入 TikHub API Token:',
    name: 'token',
    type: 'password',
  })

  const trimmed = (token || '').trim()
  if (!trimmed) {
    throw new Error('未提供 Token，已取消')
  }

  writeTikhubToken(configDir, trimmed)
  return trimmed
}
