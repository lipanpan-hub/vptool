/**
 * bup 命令族的交互式输入辅助:
 * 未传参数的命令经由此模块向用户收集主播选择或必填文本。
 */
import {existsSync} from 'node:fs'
import {isAbsolute, join, resolve} from 'node:path'

import Fuse from 'fuse.js'
import prompts from 'prompts'

import {type BiliupClient, type BiliupStreamer, formatStreamerStatus} from './biliup-client.js'
import {selectOptionalFileFromDirs, type FileScanDir} from '../vtt/select-file.js'

// 常见封面图片扩展名, 交互选择时据此过滤候选文件
const COVER_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png']

// 封面额外扫描的子目录名(与 mpv/fft 命令的扫描范围保持一致)
const EXTRA_SCAN_DIR_NAME = '.ytbflow'

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

// B 站分区表(全量大区 + 二级分区), 按常用度排序; 校对自 bilibili-API-collect「视频分区一览」
// 与 biliup tid 分区表, 并经 B 站开放平台分区文档样例核对(截至 2026-10)
interface BiliTidZone {
  zoneName: string
  mainTid: number
  subs: {name: string, tid: number}[]
}

const BILI_TID_ZONES: BiliTidZone[] = [
  {
    zoneName: '游戏', mainTid: 4, subs: [
      {tid: 17, name: '单机游戏'},
      {tid: 171, name: '电子竞技'},
      {tid: 172, name: '手机游戏'},
      {tid: 65, name: '网络游戏'},
      {tid: 173, name: '桌游棋牌'},
      {tid: 121, name: 'GMV'},
      {tid: 136, name: '音游'},
      {tid: 19, name: 'Mugen'},
    ],
  },
  {
    zoneName: '生活', mainTid: 160, subs: [
      {tid: 21, name: '日常'},
      {tid: 138, name: '搞笑'},
      {tid: 250, name: '出行'},
      {tid: 254, name: '亲子'},
      {tid: 251, name: '三农'},
      {tid: 239, name: '家居房产'},
      {tid: 161, name: '手工'},
      {tid: 162, name: '绘画'},
    ],
  },
  {
    zoneName: '知识', mainTid: 36, subs: [
      {tid: 201, name: '科学科普'},
      {tid: 124, name: '社科·法律·心理'},
      {tid: 228, name: '人文历史'},
      {tid: 207, name: '财经商业'},
      {tid: 208, name: '校园学习'},
      {tid: 209, name: '职业职场'},
      {tid: 229, name: '设计·创意'},
      {tid: 122, name: '野生技术协会'},
    ],
  },
  {
    zoneName: '音乐', mainTid: 3, subs: [
      {tid: 28, name: '原创音乐'},
      {tid: 31, name: '翻唱'},
      {tid: 59, name: '演奏'},
      {tid: 193, name: 'MV'},
      {tid: 29, name: '音乐现场'},
      {tid: 30, name: 'VOCALOID·UTAU'},
      {tid: 243, name: '乐评盘点'},
      {tid: 244, name: '音乐教学'},
      {tid: 265, name: 'AI音乐'},
      {tid: 266, name: '音乐粉丝饭拍'},
      {tid: 267, name: '电台'},
      {tid: 130, name: '音乐综合'},
    ],
  },
  {
    zoneName: '影视', mainTid: 181, subs: [
      {tid: 182, name: '影视杂谈'},
      {tid: 183, name: '影视剪辑'},
      {tid: 85, name: '短片'},
      {tid: 184, name: '预告·资讯'},
    ],
  },
  {
    zoneName: '动画', mainTid: 1, subs: [
      {tid: 24, name: 'MAD·AMV'},
      {tid: 25, name: 'MMD·3D'},
      {tid: 47, name: '同人·手书'},
      {tid: 257, name: '配音'},
      {tid: 253, name: '动漫杂谈'},
      {tid: 210, name: '手办·模玩'},
      {tid: 86, name: '特摄'},
      {tid: 27, name: '综合'},
    ],
  },
  {
    zoneName: '美食', mainTid: 211, subs: [
      {tid: 76, name: '美食制作'},
      {tid: 212, name: '美食侦探'},
      {tid: 213, name: '美食测评'},
      {tid: 214, name: '田园美食'},
      {tid: 215, name: '美食记录'},
    ],
  },
  {
    zoneName: '舞蹈', mainTid: 129, subs: [
      {tid: 20, name: '宅舞'},
      {tid: 198, name: '街舞'},
      {tid: 199, name: '明星舞蹈'},
      {tid: 200, name: '国风舞蹈'},
      {tid: 255, name: '颜值·网红舞'},
      {tid: 154, name: '舞蹈综合'},
      {tid: 156, name: '舞蹈教程'},
    ],
  },
  {
    zoneName: '鬼畜', mainTid: 119, subs: [
      {tid: 22, name: '鬼畜调教'},
      {tid: 26, name: '音MAD'},
      {tid: 126, name: '人力VOCALOID'},
      {tid: 216, name: '鬼畜剧场'},
      {tid: 127, name: '教程演示'},
    ],
  },
  {
    zoneName: '国创', mainTid: 167, subs: [
      {tid: 153, name: '国产动画'},
      {tid: 168, name: '国产原创相关'},
      {tid: 169, name: '布袋戏'},
      {tid: 195, name: '动态漫·广播剧'},
      {tid: 170, name: '资讯'},
    ],
  },
  {
    zoneName: '娱乐', mainTid: 5, subs: [
      {tid: 241, name: '娱乐杂谈'},
      {tid: 262, name: 'CP安利'},
      {tid: 263, name: '颜值安利'},
      {tid: 242, name: '娱乐粉丝创作'},
      {tid: 264, name: '娱乐资讯'},
      {tid: 137, name: '明星综合'},
      {tid: 71, name: '综艺'},
    ],
  },
  {
    zoneName: '科技', mainTid: 188, subs: [
      {tid: 95, name: '数码'},
      {tid: 230, name: '软件应用'},
      {tid: 231, name: '计算机技术'},
      {tid: 232, name: '科工机械'},
      {tid: 233, name: '极客DIY'},
    ],
  },
  {
    zoneName: '动物圈', mainTid: 217, subs: [
      {tid: 218, name: '喵星人'},
      {tid: 219, name: '汪星人'},
      {tid: 222, name: '小宠异宠'},
      {tid: 221, name: '野生动物'},
      {tid: 220, name: '动物二创'},
      {tid: 75, name: '动物综合'},
    ],
  },
  {
    zoneName: '运动', mainTid: 234, subs: [
      {tid: 235, name: '篮球'},
      {tid: 249, name: '足球'},
      {tid: 164, name: '健身'},
      {tid: 236, name: '竞技体育'},
      {tid: 237, name: '运动文化'},
      {tid: 238, name: '运动综合'},
    ],
  },
  {
    zoneName: '汽车', mainTid: 223, subs: [
      {tid: 258, name: '汽车知识科普'},
      {tid: 227, name: '购车攻略'},
      {tid: 247, name: '新能源车'},
      {tid: 245, name: '赛车'},
      {tid: 246, name: '改装玩车'},
      {tid: 240, name: '摩托车'},
      {tid: 248, name: '房车'},
      {tid: 176, name: '汽车生活'},
    ],
  },
  {
    zoneName: '时尚', mainTid: 155, subs: [
      {tid: 157, name: '美妆护肤'},
      {tid: 252, name: '仿妆cos'},
      {tid: 158, name: '穿搭'},
      {tid: 159, name: '时尚潮流'},
    ],
  },
  {
    zoneName: '纪录片', mainTid: 177, subs: [
      {tid: 37, name: '人文·历史'},
      {tid: 178, name: '科学·探索·自然'},
      {tid: 179, name: '军事'},
      {tid: 180, name: '社会·美食·旅行'},
    ],
  },
  {
    zoneName: '电影', mainTid: 23, subs: [
      {tid: 147, name: '国产电影'},
      {tid: 146, name: '日本电影'},
      {tid: 145, name: '欧美电影'},
      {tid: 83, name: '其他国家'},
    ],
  },
  {
    zoneName: '电视剧', mainTid: 11, subs: [
      {tid: 185, name: '国产剧'},
      {tid: 187, name: '海外剧'},
    ],
  },
  {
    zoneName: '番剧', mainTid: 13, subs: [
      {tid: 33, name: '连载动画'},
      {tid: 32, name: '完结动画'},
      {tid: 51, name: '资讯'},
      {tid: 152, name: '官方延伸'},
    ],
  },
  {
    zoneName: '资讯', mainTid: 202, subs: [
      {tid: 203, name: '热点'},
      {tid: 204, name: '环球'},
      {tid: 205, name: '社会'},
      {tid: 206, name: '综合'},
    ],
  },
]

// 摊平成选择项: 标题附大区名以便区分重名分区(如两处"资讯"), 同时可按大区名搜索; 单独导出便于测试
export const BILI_TID_CHOICES: {title: string, value: number}[] = BILI_TID_ZONES.flatMap((zone) => [
  {title: `${zone.mainTid} ${zone.zoneName}(主分区)`, value: zone.mainTid},
  ...zone.subs.map((sub) => ({title: `${sub.tid} ${sub.name}(${zone.zoneName})`, value: sub.tid})),
])

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
  dtime?: string
}

/** 收集结果: tid/copyright/limit 必有值, 其余 undefined 表示不向 biliup 传该参数; dtime 保持人类可读文本, 组装 biliup 参数时才转时间戳 */
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
  dtime?: string
}

/**
 * 交互式补全 upload 的投稿参数: 命令行已提供的值原样沿用, 仅对未提供的逐项提问。
 * 各提问均有默认项或允许回车跳过; 延时发布例外——回车取默认(+5 小时后发布), 输入 - 才不延时。
 * 自测时经 prompts.inject() 注入答案(全局队列按提问顺序消费)。
 */
export async function promptUploadOptions(flags: BupUploadFlagsSnapshot): Promise<BupUploadOptions> {
  // #region 纯文本项: 回车跳过即视为不向 biliup 传参
  const title = flags.title ?? (await askOptionalText('视频标题(回车跳过, 缺省按文件名处理):'))
  const desc = flags.desc ?? (await askOptionalText('视频简介(回车跳过):'))
  const tag = flags.tag ?? (await askOptionalText('视频标签, 逗号分隔(回车跳过):'))
  const cover = flags.cover ?? (await askCoverPath())
  const dynamic = flags.dynamic ?? (await askOptionalText('空间动态内容(回车跳过):'))
  const dtime = flags.dtime ?? (await askDelayTime())
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

  // #region 投稿分区: 全量分区表模糊搜索选择, 也可手动输入任意 id
  let tid = flags.tid
  if (tid === undefined) {
    const selected = await askSelectWithSearch<number>('投稿分区(输入分区名/大区名/id 过滤):', [
      ...BILI_TID_CHOICES,
      {title: '手动输入分区 id…', value: MANUAL_TID_VALUE},
    ])
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
 * 不提问直接补全 upload 的投稿参数(--json 模式用): 未提供的 tid/copyright/limit 取交互默认值, 其余保持 undefined。
 */
export function fillUploadOptionsWithDefaults(flags: BupUploadFlagsSnapshot): BupUploadOptions {
  // 显式挑字段, 避免把 oclif flags 里的无关键(如 fromYaml)带进预设落盘
  return {
    copyright: flags.copyright ?? 1,
    cover: flags.cover,
    desc: flags.desc,
    dtime: flags.dtime,
    dynamic: flags.dynamic,
    limit: flags.limit ?? 3,
    line: flags.line,
    source: flags.source,
    submit: flags.submit,
    tag: flags.tag,
    tid: flags.tid ?? 171,
    title: flags.title,
  }
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
 * 封面路径交互选择: 扫描当前目录与 .ytbflow 子目录的图片列表(可模糊搜索, 条目标注来源目录),
 * 首项"跳过"即不设置封面; 选中项必然真实存在, 无需再校验。
 * 两处均无图片时不弹菜单, 直接视为跳过。
 */
async function askCoverPath(): Promise<string | undefined> {
  const scanDirs: readonly FileScanDir[] = [
    {label: '当前目录', path: process.cwd()},
    {label: EXTRA_SCAN_DIR_NAME, path: join(process.cwd(), EXTRA_SCAN_DIR_NAME)},
  ]
  return selectOptionalFileFromDirs(scanDirs, COVER_IMAGE_EXTENSIONS, '封面图片(回车选首项即跳过, 可输入关键词过滤):')
}

/** 通用 select 提问, 用户中断(Ctrl+C)时统一抛"已取消" */
async function askSelect<T>(message: string, choices: {title: string, value: T}[], initial: number): Promise<T> {
  const response = await prompts({choices, initial, message, name: 'value', type: 'select'})
  if (response.value === undefined) {
    throw new Error('已取消')
  }
  return response.value as T
}

/** 带模糊搜索的长列表 select 提问(与 vtt 文件选择同一套 autocomplete + fuse 方案) */
async function askSelectWithSearch<T>(message: string, choices: {title: string, value: T}[]): Promise<T> {
  // ignoreLocation 关闭位置惩罚; threshold 取 0.65 以支持缩略词匹配(如"电竞"命中"电子竞技")且保留错字容错
  const fuse = new Fuse(choices, {keys: ['title'], threshold: 0.65, ignoreLocation: true})
  const response = await prompts({
    choices,
    message,
    name: 'value',
    suggest: async (input: string, items: any[]) => {
      if (!input) return items
      return fuse.search(input).map((searchResult) => searchResult.item)
    },
    type: 'autocomplete',
  })
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

/**
 * 解析延时发布时间文本为 10 位秒级时间戳: 格式 YYYY-MM-DD HH:mm, 按本地时区解释;
 * 距 now 不足 4 小时(B站延时发布规则)或日期不存在(如 2026-02-30)时抛错。
 * 单独导出便于测试与 upload 命令复用。
 */
export function parseDelayTime(text: string, now: Date = new Date()): number {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(text.trim())
  if (match === null) {
    throw new Error(`延时发布时间格式应为 YYYY-MM-DD HH:mm: ${text}`)
  }

  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  const parsedDate = new Date(year, month - 1, day, hour, minute)
  // 往返校验: 防止 2026-02-30 这类不存在的日期被 Date 静默进位成 3 月初
  const isRealDate = (parsedDate.getFullYear() === year) && (parsedDate.getMonth() === month - 1)
    && (parsedDate.getDate() === day) && (parsedDate.getHours() === hour) && (parsedDate.getMinutes() === minute)
  if (!isRealDate) {
    throw new Error(`延时发布时间不存在: ${text}`)
  }

  const delaySeconds = (parsedDate.getTime() - now.getTime()) / 1000
  if (delaySeconds <= 4 * 3600) {
    throw new Error(`延时发布时间需晚于现在 4 小时: ${text}`)
  }
  return Math.floor(parsedDate.getTime() / 1000)
}

/** dtime 交互输入校验: 格式与时限不合法时返回错误消息, 合法返回 true */
function validateDelayTime(inputValue: string): string | true {
  try {
    parseDelayTime(inputValue)
    return true
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

// 两位数补零(延时时间的月/日/时/分格式化用)
const pad2 = (num: number) => String(num).padStart(2, '0')

/** 默认延时时刻: 当前时间 + 5 小时(留出 B 站 >4 小时规则的余量), 格式化为 YYYY-MM-DD HH:mm; 单独导出便于测试 */
export function buildDefaultDelayTime(now: Date = new Date()): string {
  const defaultDate = new Date(now.getTime() + 5 * 3600 * 1000)
  return `${defaultDate.getFullYear()}-${pad2(defaultDate.getMonth() + 1)}-${pad2(defaultDate.getDate())} ${pad2(defaultDate.getHours())}:${pad2(defaultDate.getMinutes())}`
}

/**
 * 延时发布时间交互输入: 默认值(+5 小时后)经 initial 预填, 回车即取默认或在其基础上修改;
 * 输入 -(或清空)表示不延时; 其余按 YYYY-MM-DD HH:mm 校验, 非法时要求重填。
 */
async function askDelayTime(): Promise<string | undefined> {
  const defaultDelayText = buildDefaultDelayTime()
  const response = await prompts({
    initial: defaultDelayText,
    message: `延时发布时间(回车取默认 ${defaultDelayText}, 输入 - 不延时):`,
    name: 'value',
    type: 'text',
    validate: (inputValue: string) => {
      const trimmedText = inputValue.trim()
      if (trimmedText === '' || trimmedText === '-') {
        return true
      }
      return validateDelayTime(trimmedText)
    },
  })
  if (response.value === undefined) {
    throw new Error('已取消')
  }
  const trimmedText = (response.value as string).trim()
  return trimmedText === '' || trimmedText === '-' ? undefined : trimmedText
}
