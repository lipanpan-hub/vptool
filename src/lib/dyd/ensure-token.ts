import prompts from 'prompts'

import {ToolConfigManager} from '../config/index.js'

export async function ensureTikhubToken(configDir: string): Promise<string> {
  const configManager = ToolConfigManager.fromConfigDir(configDir)
  const existing = configManager.getTikhubToken()
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

  configManager.setTikhubToken(trimmed)
  return trimmed
}
