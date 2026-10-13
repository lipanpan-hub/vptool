import {Args, Flags} from '@oclif/core'
import {spawnSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {isAbsolute, join, resolve} from 'node:path'

import {BaseCommand} from '../../lib/base-command.js'
import {ToolConfigManager} from '../../lib/config/index.js'
import {selectFile} from '../../lib/vtt/select-file.js'

// 常见视频扩展名, 交互选择时据此过滤当前目录文件
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.flv', '.webm', '.ts', '.mov', '.avi', '.m4v']

// biliup 上传线路的可选值(与 biliup upload --help 一致)
const UPLOAD_LINES = ['bldsa', 'cnbldsa', 'andsa', 'atdsa', 'bda2', 'cnbd', 'anbd', 'atbd', 'tx', 'cntx', 'antx', 'attx', 'txa', 'alia', 'estx', 'akbd']

export default class BupUpload extends BaseCommand {
  // 允许多个位置参数(多P投稿), 通过 argv 收集
  static strict = false

  static args = {
    files: Args.string({description: '视频文件路径(可传多个实现多P投稿; 全部省略则交互选择)', required: false}),
  }

  static description = '上传本地视频投稿到B站(调用配置目录下的 biliup.exe, 登录态取该目录 cookies.json)'

  static examples = [
    '<%= config.bin %> <%= command.id %> video.mp4 --title 标题 --tag 标签1,标签2 --tid 171',
    '<%= config.bin %> <%= command.id %> part1.mp4 part2.mp4 --title 多P标题',
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    title: Flags.string({description: '视频标题(缺省由 biliup 按文件名处理)'}),
    desc: Flags.string({description: '视频简介'}),
    tag: Flags.string({description: '视频标签, 逗号分隔多个'}),
    tid: Flags.integer({description: '投稿分区 id', default: 171}),
    copyright: Flags.integer({description: '1-自制 2-转载', default: 1}),
    source: Flags.string({description: '转载来源(copyright=2 时使用)'}),
    cover: Flags.string({description: '封面图片路径'}),
    line: Flags.string({description: `上传线路(${UPLOAD_LINES.join('/')})`}),
    limit: Flags.integer({description: '单文件最大并发数', default: 3}),
    submit: Flags.string({description: '提交接口', options: ['app', 'web', 'b-cut-android']}),
    dynamic: Flags.string({description: '空间动态内容'}),
    // 延时发布: 距提交需大于 4 小时的 10 位秒级时间戳
    dtime: Flags.integer({description: '延时发布的 10 位秒级时间戳'}),
  }

  public async run(): Promise<void> {
    const {argv, flags} = await this.parse(BupUpload)

    const biliupRDir = ToolConfigManager.fromConfigDir(this.config.configDir).getBiliupRDir()
    if (biliupRDir === null) {
      this.error('未配置 biliupR 目录, 请先执行: vp bup cfset <biliupR目录>')
    }

    // #region 确定待上传文件(交互选择或直通)
    // argv 在 strict=false 时可能混入 flags 后的额外位置参数, 全部按文件路径处理
    const inputFiles = (argv ?? []).map(String).filter((pathText) => pathText !== '')
    const videoPaths: string[] = []
    if (inputFiles.length === 0) {
      videoPaths.push(await selectFile(VIDEO_EXTENSIONS, '请选择要投稿的视频文件:'))
    } else {
      for (const inputFile of inputFiles) {
        // 相对路径统一按当前工作目录解析
        const absolutePath = isAbsolute(inputFile) ? inputFile : resolve(inputFile)
        if (!existsSync(absolutePath)) {
          this.error(`文件不存在: ${absolutePath}`)
        }
        videoPaths.push(absolutePath)
      }
    }
    // #endregion

    // #region 组装 biliup 参数
    const biliupArguments = ['upload', ...videoPaths]
    if (flags.title !== undefined) biliupArguments.push('--title', flags.title)
    if (flags.desc !== undefined) biliupArguments.push('--desc', flags.desc)
    if (flags.tag !== undefined) biliupArguments.push('--tag', flags.tag)
    biliupArguments.push('--tid', String(flags.tid), '--copyright', String(flags.copyright))
    if (flags.source !== undefined) biliupArguments.push('--source', flags.source)
    if (flags.cover !== undefined) biliupArguments.push('--cover', flags.cover)
    if (flags.line !== undefined) biliupArguments.push('--line', flags.line)
    biliupArguments.push('--limit', String(flags.limit))
    if (flags.submit !== undefined) biliupArguments.push('--submit', flags.submit)
    if (flags.dynamic !== undefined) biliupArguments.push('--dynamic', flags.dynamic)
    if (flags.dtime !== undefined) biliupArguments.push('--dtime', String(flags.dtime))
    // #endregion

    // #region 前台执行上传(继承 stdio 展示 biliup 原生进度, cwd 指向 biliupR 目录以读取 cookies.json)
    this.log(`开始上传 ${videoPaths.length} 个文件到B站...`)
    // spawn 在 Windows 下不会从 cwd 选项解析可执行文件, 必须用绝对路径
    const biliupExePath = join(biliupRDir, 'biliup.exe')
    const spawnResult = spawnSync(biliupExePath, biliupArguments, {
      cwd: biliupRDir,
      stdio: 'inherit',
      shell: false,
    })
    if (spawnResult.error !== undefined) {
      this.error(`biliup 启动失败: ${spawnResult.error.message}`)
    }
    if (spawnResult.status !== 0) {
      this.error(`投稿失败, biliup 退出码: ${spawnResult.status}`)
    }
    this.log('投稿完成')
    // #endregion
  }
}
