import {Args, Flags} from '@oclif/core'
import {spawnSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {join, resolve} from 'node:path'

import {BaseCommand} from '../../lib/base-command.js'
import {
  UPLOAD_LINES,
  collectUploadVideoPaths,
  fillUploadOptionsWithDefaults,
  promptUploadOptions,
  type BupUploadFlagsSnapshot,
  type BupUploadOptions,
} from '../../lib/bup/interactive.js'
import {UPLOAD_PRESET_FILENAME, loadUploadPreset, mergeUploadSources, saveUploadPreset, type UploadPreset} from '../../lib/bup/upload-preset.js'
import {ToolConfigManager} from '../../lib/config/index.js'
import {selectFile} from '../../lib/vtt/select-file.js'

// 常见视频扩展名, 交互选择时据此过滤当前目录文件
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.flv', '.webm', '.ts', '.mov', '.avi', '.m4v']

export default class BupUpload extends BaseCommand {
  // 允许多个位置参数(多P投稿), 通过 argv 收集
  static strict = false

  static args = {
    files: Args.string({description: '视频文件路径(可传多个实现多P投稿; 全部省略则交互选择)', required: false}),
  }

  static description = '上传本地视频投稿到B站(调用配置目录下的 biliup.exe, 登录态取该目录 cookies.json); 未提供的参数会交互式提问收集'

  static examples = [
    '<%= config.bin %> <%= command.id %> video.mp4 --title 标题 --tag 标签1,标签2 --tid 171',
    '<%= config.bin %> <%= command.id %> part1.mp4 part2.mp4 --title 多P标题',
    '<%= config.bin %> <%= command.id %> --from-yaml bup-upload.yml',
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    // tid/copyright/limit 故意不设 default: 需区分"用户主动传参"与"默认值", 未传时走交互提问
    title: Flags.string({description: '视频标题(缺省由 biliup 按文件名处理)'}),
    desc: Flags.string({description: '视频简介'}),
    tag: Flags.string({description: '视频标签, 逗号分隔多个'}),
    tid: Flags.integer({description: '投稿分区 id(未传时交互选择, 交互默认 171)'}),
    copyright: Flags.integer({description: '1-自制 2-转载(未传时交互选择, 交互默认 1)'}),
    source: Flags.string({description: '转载来源(copyright=2 时使用)'}),
    cover: Flags.string({description: '封面图片路径'}),
    line: Flags.string({description: `上传线路(${UPLOAD_LINES.join('/')})`}),
    limit: Flags.integer({description: '单文件最大并发数(未传时交互输入, 交互默认 3)'}),
    submit: Flags.string({description: '提交接口', options: ['app', 'web', 'b-cut-android']}),
    dynamic: Flags.string({description: '空间动态内容'}),
    // 延时发布: 距提交需大于 4 小时的 10 位秒级时间戳
    dtime: Flags.integer({description: '延时发布的 10 位秒级时间戳'}),
    fromYaml: Flags.string({description: `从 yaml 预设导入视频路径与投稿参数(缺项继续交互), 如 --from-yaml ${UPLOAD_PRESET_FILENAME}`}),
  }

  public async run(): Promise<{presetPath: string; uploadOptions: BupUploadOptions; videoPaths: string[]}> {
    const {argv, flags} = await this.parse(BupUpload)

    const biliupRDir = ToolConfigManager.fromConfigDir(this.config.configDir).getBiliupRDir()
    if (biliupRDir === null) {
      this.error('未配置 biliupR 目录, 请先执行: vp bup cfset <biliupR目录>')
    }

    // #region 导入投稿预设(--from-yaml), 与命令行输入做三级合并: 命令行 > 预设 > 交互询问
    const presetPath = join(process.cwd(), UPLOAD_PRESET_FILENAME)
    const preset = this.loadPresetOrDefault(flags.fromYaml)
    const inputFiles = (argv ?? []).map(String).filter((pathText) => pathText !== '')
    const {files: mergedFiles, flags: mergedFlags} = mergeUploadSources(inputFiles, flags, preset)
    // #endregion

    // #region 确定待上传文件(预设列表/交互选择/直通), 全部规范化为绝对路径(biliup 以 biliupR 目录为 cwd 启动, 相对路径会指向错误位置)
    if (mergedFiles.length === 0) {
      this.rejectInteractionInJsonMode('<files> 参数(视频文件路径)或 --from-yaml <预设文件>')
    }
    let videoPaths: string[]
    try {
      videoPaths = await collectUploadVideoPaths(mergedFiles, () => selectFile(VIDEO_EXTENSIONS, '请选择要投稿的视频文件:'))
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error))
    }
    // #endregion

    // #region 交互补全未提供的投稿参数(命令行/预设已提供的原样沿用)
    const uploadOptions = await this.resolveUploadOptions(mergedFlags)
    // 封面统一解析为绝对路径(biliup cwd 在 biliupR 目录, 交互选择返回裸文件名)
    if (uploadOptions.cover !== undefined) uploadOptions.cover = resolve(uploadOptions.cover)
    // #endregion

    // #region 自动保存投稿预设到当前目录(每次覆盖, 供下次 --from-yaml 复用)
    saveUploadPreset(presetPath, videoPaths, uploadOptions)
    this.log(`投稿参数已保存: ${presetPath}`)
    // #endregion

    // #region 组装 biliup 参数(值为 undefined 的项不传, 沿用 biliup 自身默认行为)
    const biliupArguments = ['upload', ...videoPaths]
    if (uploadOptions.title !== undefined) biliupArguments.push('--title', uploadOptions.title)
    if (uploadOptions.desc !== undefined) biliupArguments.push('--desc', uploadOptions.desc)
    if (uploadOptions.tag !== undefined) biliupArguments.push('--tag', uploadOptions.tag)
    biliupArguments.push('--tid', String(uploadOptions.tid), '--copyright', String(uploadOptions.copyright))
    if (uploadOptions.source !== undefined) biliupArguments.push('--source', uploadOptions.source)
    if (uploadOptions.cover !== undefined) biliupArguments.push('--cover', uploadOptions.cover)
    if (uploadOptions.line !== undefined) biliupArguments.push('--line', uploadOptions.line)
    biliupArguments.push('--limit', String(uploadOptions.limit))
    if (uploadOptions.submit !== undefined) biliupArguments.push('--submit', uploadOptions.submit)
    if (uploadOptions.dynamic !== undefined) biliupArguments.push('--dynamic', uploadOptions.dynamic)
    if (uploadOptions.dtime !== undefined) biliupArguments.push('--dtime', String(uploadOptions.dtime))
    // #endregion

    // #region 前台执行上传(继承 stdio 展示 biliup 原生进度, cwd 指向 biliupR 目录以读取 cookies.json)
    this.log(`开始上传 ${videoPaths.length} 个文件到B站...`)
    // spawn 在 Windows 下不会从 cwd 选项解析可执行文件, 必须用绝对路径
    const biliupExePath = join(biliupRDir, 'biliup.exe')
    // JSON 模式把子进程 stdout(fd 1)重定向到 stderr(fd 2), 保证 stdout 只留结果 JSON
    const spawnResult = spawnSync(biliupExePath, biliupArguments, {
      cwd: biliupRDir,
      stdio: this.jsonEnabled() ? ['inherit', 2, 'inherit'] : 'inherit',
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

    return {presetPath, uploadOptions, videoPaths}
  }

  // 补全投稿参数: 交互模式逐项提问; JSON 模式不提问, 转载必须显式给来源, 其余未提供项取交互默认值
  private async resolveUploadOptions(mergedFlags: BupUploadFlagsSnapshot): Promise<BupUploadOptions> {
    // 预设中的封面文件已不存在时视为未提供, 回退交互重问
    if (mergedFlags.cover !== undefined && !existsSync(mergedFlags.cover)) {
      this.warn(`封面文件不存在, 将重新询问: ${mergedFlags.cover}`)
      mergedFlags.cover = undefined
    }

    if (!this.jsonEnabled()) {
      return promptUploadOptions(mergedFlags)
    }
    if ((mergedFlags.copyright === 2) && (mergedFlags.source === undefined)) {
      this.rejectInteractionInJsonMode('--source <转载来源>(copyright=2 时必填)')
    }
    return fillUploadOptionsWithDefaults(mergedFlags)
  }

  // 读取 --from-yaml 指定的预设(相对路径按当前目录解析); 未传 flag 返回 undefined, 文件非法时终止命令
  private loadPresetOrDefault(fromYamlPath: string | undefined): UploadPreset | undefined {
    if (fromYamlPath === undefined) {
      return undefined
    }
    const importPath = resolve(fromYamlPath)
    try {
      const preset = loadUploadPreset(importPath)
      this.log(`已导入投稿预设: ${importPath}`)
      return preset
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error))
    }
  }
}
