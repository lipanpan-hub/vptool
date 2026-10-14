/**
 * bup 命令族的交互式输入辅助:
 * 未传参数的命令经由此模块向用户收集主播选择或必填文本。
 */
import {existsSync} from 'node:fs'
import {isAbsolute, resolve} from 'node:path'

import prompts from 'prompts'

import {type BiliupClient, type BiliupStreamer, formatStreamerStatus} from './biliup-client.js'
import {selectOptionalFile} from '../vtt/select-file.js'

// 常见封面图片扩展名, 交互选择时据此过滤当前目录文件
const COVER_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png']

/**
 * 收集待上传视频的绝对路径列表(upload 用): 命令行传参时逐个校验存在性,
 * 未传参时经 selectVideoFile 回调交互选择。统一解析为绝对路径——
 * biliup 以 biliupR 目录为 cwd 启动, 相对路径会指向错误位置(真实踩坑)。
 */
export async function collectUploadVideoPaths(
  inputFiles: string[],
  selectVideoFile: () => Promise<string>,
): Promise<string[]> {
  // #region 未传参: 交互选择(selectFile 返回裸文件名), 必须解析为绝对路径
  if (inputFiles.length === 0) {
    return [resolve(await selectVideoFile())]
  }
  // #endregion

  // #region 命令行传参: 相对路径按调用时工作目录解析, 不存在直接报错
  const absolutePaths: string[] = []
  for (const inputFile of inputFiles) {
    const absolutePath = isAbsolute(inputFile) ? inputFile : resolve(inputFile)
    if (!existsSync(absolutePath)) {
      throw new Error(`文件不存在: ${absolutePath}`)
    }
    absolutePaths.push(absolutePath)
  }
  return absolutePaths
  // #endregion
}

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

// biliup 上传线路的可选值(与 biliup upload --help 一致)
export const UPLOAD_LINES = ['bldsa', 'cnbldsa', 'andsa', 'atdsa', 'bda2', 'cnbd', 'anbd', 'atbd', 'tx', 'cntx', 'antx', 'attx', 'txa', 'alia', 'estx', 'akbd']

// 常用投稿分区精选列表, 末项提供手动输入任意 id 的兜底
const COMMON_TID_CHOICES = [
  {title: '171 电子竞技', value: 171},
  {title: '17 单机游戏', value: 17},
  {title: '172 网络游戏', value: 172},
  {title: '4 游戏综合', value: 4},
  {title: '21 日常', value: 21},
  {title: '231 生活', value: 231},
  {title: '36 知识', value: 36},
  {title: '201 科学科普', value: 201},
  {title: '124 社科·法律·心理', value: 124},
  {title: '207 人文历史', value: 207},
  {title: '209 野生技术协会', value: 209},
  {title: '3 音乐', value: 3},
  {title: '28 原创音乐', value: 28},
  {title: '31 翻唱', value: 31},
  {title: '129 舞蹈', value: 129},
  {title: '5 娱乐', value: 5},
  {title: '181 影视', value: 181},
  {title: '182 影视杂谈', value: 182},
  {title: '183 影视剪辑', value: 183},
  {title: '119 鬼畜', value: 119},
  {title: '234 动物圈', value: 234},
  {title: '211 美食', value: 211},
]

// "手动输入分区 id"选项的哨兵值, 命中后追问数字输入
const MANUAL_TID_VALUE = -1

/** upload 命令 flags 快照(仅含交互涉及的键), 结构与 oclif 解析结果兼容 */
export interface BupUploadFlagsSnapshot {
  title?: string
  desc?: string
  tag?: string
  tid?: number
  copyright?: number
  source?: string
  cover?: string
  line?: string
  limit?: number
  submit?: string
  dynamic?: string
  dtime?: number
}

/** 收集结果: tid/copyright/limit 必有值, 其余 undefined 表示不向 biliup 传该参数 */
export interface BupUploadOptions {
  title?: string
  desc?: string
  tag?: string
  tid: number
  copyright: number
  source?: string
  cover?: string
  line?: string
  limit: number
  submit?: string
  dynamic?: string
  dtime?: number
}

/**
 * 交互式补全 upload 的投稿参数: 命令行已提供的值原样沿用, 仅对未提供的逐项提问。
 * 所有提问均有默认项或允许回车跳过, 一路回车即按默认值投稿。
 * 自测时经 prompts.inject() 注入答案(全局队列按提问顺序消费)。
 */
export async function promptUploadOptions(flags: BupUploadFlagsSnapshot): Promise<BupUploadOptions> {
  // #region 纯文本项: 回车跳过即视为不向 biliup 传参
  const title = flags.title ?? (await askOptionalText('视频标题(回车跳过, 缺省按文件名处理):'))
  const desc = flags.desc ?? (await askOptionalText('视频简介(回车跳过):'))
  const tag = flags.tag ?? (await askOptionalText('视频标签, 逗号分隔(回车跳过):'))
  const cover = flags.cover ?? (await askCoverPath())
  const dynamic = flags.dynamic ?? (await askOptionalText('空间动态内容(回车跳过):'))
  const dtimeText = await askOptionalText('延时发布的 10 位秒级时间戳(回车跳过):', validateUnixSeconds)
  const dtime = dtimeText === undefined ? undefined : Number(dtimeText)
  // #endregion

  // #region 作品类型: 决定是否追问转载来源
  let copyright = flags.copyright
  if (copyright === undefined) {
    copyright = await askSelect<number>('作品类型:', [
      {title: '1 自制', value: 1},
      {title: '2 转载', value: 2},
    ], 0)
  }
  const source = copyright === 2
    ? (flags.source ?? (await promptRequiredText('转载来源(视频地址/作者):')))
    : flags.source
  // #endregion

  // #region 投稿分区: 常用列表选择或手动输入 id
  let tid = flags.tid
  if (tid === undefined) {
    const selected = await askSelect<number>('投稿分区:', [
      ...COMMON_TID_CHOICES,
      {title: '手动输入分区 id…', value: MANUAL_TID_VALUE},
    ], 0)
    tid = selected === MANUAL_TID_VALUE ? (await askRequiredNumber('分区 id:')) : selected
  }
  // #endregion

  // #region 上传线路与提交接口: 首项均为"不指定"直通 biliup 默认行为
  let line = flags.line
  if (line === undefined) {
    const selected = await askSelect<string>('上传线路:', [
      {title: '自动(不指定线路)', value: ''},
      ...UPLOAD_LINES.map((lineName) => ({title: lineName, value: lineName})),
    ], 0)
    line = selected === '' ? undefined : selected
  }

  let submit = flags.submit
  if (submit === undefined) {
    const selected = await askSelect<string>('提交接口:', [
      {title: '默认(不指定)', value: ''},
      {title: 'app', value: 'app'},
      {title: 'web', value: 'web'},
      {title: 'b-cut-android', value: 'b-cut-android'},
    ], 0)
    submit = selected === '' ? undefined : selected
  }
  // #endregion

  const limit = flags.limit ?? (await askNumberWithDefault('单文件最大并发数', 3))

  return {title, desc, tag, tid, copyright, source, cover, line, limit, submit, dynamic, dtime}
}

/**
 * 询问一段可留空的文本, 回车跳过返回 undefined; 提供 validate 时对非空输入校验。
 */
async function askOptionalText(message: string, validate?: (inputValue: string) => string | true): Promise<string | undefined> {
  const response = await prompts({message, name: 'value', type: 'text', validate})
  if (response.value === undefined) {
    throw new Error('已取消')
  }
  const trimmedText = (response.value as string).trim()
  return trimmedText === '' ? undefined : trimmedText
}

/**
 * 封面路径交互选择: 扫描当前目录图片列表(可模糊搜索), 首项"跳过"即不设置封面;
 * 选中项必然真实存在, 无需再校验。目录无图片时仅剩跳过项, 同样可回车跳过。
 */
async function askCoverPath(): Promise<string | undefined> {
  return selectOptionalFile(COVER_IMAGE_EXTENSIONS, '封面图片(回车选首项即跳过, 可输入关键词过滤):')
}

/** 通用 select 提问, 用户中断(Ctrl+C)时统一抛"已取消" */
async function askSelect<T>(message: string, choices: {title: string, value: T}[], initial: number): Promise<T> {
  const response = await prompts({choices, initial, message, name: 'value', type: 'select'})
  if (response.value === undefined) {
    throw new Error('已取消')
  }
  return response.value as T
}

/** 询问必填非负整数(手动输入分区 id 用), 空输入会被要求重填 */
async function askRequiredNumber(message: string): Promise<number> {
  const response = await prompts({
    message,
    name: 'value',
    type: 'text',
    validate: (inputValue: string) => (/^\d+$/.test(inputValue.trim()) ? true : '请输入非负整数'),
  })
  if (response.value === undefined) {
    throw new Error('已取消')
  }
  return Number(response.value.trim())
}

/** 询问可留空的整数, 回车返回默认值 */
async function askNumberWithDefault(message: string, defaultValue: number): Promise<number> {
  const response = await prompts({
    message: `${message}(回车取默认 ${defaultValue}):`,
    name: 'value',
    type: 'text',
    validate: (inputValue: string) => (inputValue.trim() === '' || /^\d+$/.test(inputValue.trim()) ? true : '请输入非负整数或回车取默认'),
  })
  if (response.value === undefined) {
    throw new Error('已取消')
  }
  const trimmedText = (response.value as string).trim()
  return trimmedText === '' ? defaultValue : Number(trimmedText)
}

/** dtime 校验: 必须是 10 位秒级时间戳 */
function validateUnixSeconds(inputValue: string): string | true {
  return inputValue.trim() === '' || /^\d{10}$/.test(inputValue.trim()) ? true : '请输入 10 位秒级时间戳'
}
