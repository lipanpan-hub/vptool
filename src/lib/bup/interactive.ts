/**
 * bup 命令族的交互式输入辅助:
 * 未传参数的命令经由此模块向用户收集主播选择或必填文本。
 */
import prompts from 'prompts'

import {type BiliupClient, type BiliupStreamer, formatStreamerStatus} from './biliup-client.js'

/**
 * 交互式选择一个监控主播(rm/pause/resume 复用), 返回选中主播对象。
 */
export async function selectStreamer(client: BiliupClient, message: string): Promise<BiliupStreamer> {
  const streamers = await client.listStreamers()
  if (streamers.length === 0) {
    throw new Error('暂无监控主播, 可执行: vp bup add <直播间地址> --remark <备注名>')
  }

  const response = await prompts({
    type: 'select',
    name: 'streamer',
    message,
    choices: streamers.map((streamer) => ({
      title: `[${streamer.id}] ${streamer.remark} (${formatStreamerStatus(streamer)})`,
      value: streamer,
    })),
  })

  if (response.streamer === undefined) {
    throw new Error('未选择主播, 已取消')
  }
  return response.streamer as BiliupStreamer
}

/**
 * 按 id 定位主播, 不存在时抛出带指引的错误(与交互选择共用同一套校验)。
 */
export async function requireStreamerById(client: BiliupClient, streamerId: number): Promise<BiliupStreamer> {
  const streamers = await client.listStreamers()
  const target = streamers.find((streamer) => streamer.id === streamerId)
  if (target === undefined) {
    throw new Error(`主播不存在: id=${streamerId}, 可执行 vp bup streamers 查看现有 id`)
  }
  return target
}

/**
 * 交互式输入一段非空文本(add/cfset 复用), 空输入会被要求重填。
 */
export async function promptRequiredText(message: string): Promise<string> {
  const response = await prompts({
    type: 'text',
    name: 'value',
    message,
    validate: (inputValue: string) => (inputValue.trim() === '' ? '输入不能为空' : true),
  })

  if (response.value === undefined) {
    throw new Error('未输入内容, 已取消')
  }
  return response.value.trim()
}
