@lppx/vptool
=================

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@lppx/vptool.svg)](https://npmjs.org/package/@lppx/vptool)

`vptool`（命令名 `vp`）是一个面向「视频 → 音频 → 字幕」全链路的命令行工具。它把日常反复用到的
yt-dlp / ffmpeg 调用、抖音视频解析、VTT 字幕整理这些零散操作，收敛成一组带交互式选择的子命令，
不用再记一长串参数。

# 安装方法

## 从 npm 安装（推荐）

```bash
npm install -g @lppx/vptool
```

安装完成后可执行文件为 `vp`：

```bash
vp --version
vp --help
```

## 从源码安装

```bash
git clone https://github.com/lipanpan-hub/vptool.git
cd vptool
npm install
npm run build
npm link          # 把 vp 链接到全局
```

> Linux / macOS 下若出现 `Permission denied`，给入口脚本补上执行权限：
> `chmod +x bin/run.js bin/dev.js`



## 运行环境

- Node.js >= 18
- `yt-dlp` 与 `ffmpeg`：无需手动装，`vp dl check --update` 会自动下载到本地
- Firefox（可选）：仅在需要用浏览器 cookies 下载会员/登录内容时用到，未安装时启动会有一条提示

# 项目能力介绍

## `vp dl` — 通用视频下载（yt-dlp + ffmpeg）

支持 yt-dlp 覆盖的绝大多数站点（YouTube、Bilibili 等）。

- `vp dl <URL>` / `vp dl video <URL>`：下载视频。默认拉取格式列表让你交互式挑选清晰度，
  也可以用 `--best` 直接取最优视频+最优音频并合并，或用 `--format-id` 指定确切格式。
  `--keep-audio` 会在视频之外额外抽一份 mp3（适合喂给语音识别），`--use-cookies` 从 Firefox 取 cookies。
- `vp dl vmeta <URL>`：只看元信息（标题、时长、可用格式等），不下载。
- `vp dl check [--update]`：体检 `yt-dlp` 与 `ffmpeg` 的路径和版本，`--update` 顺手把缺的二进制装上。
- `vp dl updatebin`：把本地 `yt-dlp` 升到最新版（站点接口变动导致下载失败时，先跑这个）。
- `vp dl list [--path]`：递归列出工作目录下的文件与文件夹。
- `vp dl cd [X]`：在工作目录下交互式选目录并进入（支持拼音、模糊匹配），会开一个子 shell，`exit` 返回。
- `vp dl open`：用系统文件管理器打开工作目录。

下载产物的目录结构为：

```
<documentsPath>/<prefix>/<站点域名>/<视频标题>.<扩展名>
```

其中 `prefix` 是每次下载前交互选择的一级子目录，默认候选是 `x`。输入一个新值时会问你要不要
存进配置的 `dlPrefix` 列表，下次直接从列表里选。

## `vp dyd` — 抖音视频解析下载

`vp dyd fetch-one-video <INPUT>`（别名 `vp dyd fov`）：吃链接也吃整段分享文案（会自己把
`https://v.douyin.com/...` 抠出来），通过 TikHub 接口解析后下载，并自动抽取音频。

`--provider` 可以指定解析接口（`app-v1` / `app-v2` / `app-v3` / `app-share` / `web-share` /
`web-v2` / `web-v1`）；不指定则进入交互式菜单。某个接口失效时换一个通常就能过。

首次使用会提示输入 TikHub API Token，输入后写进配置文件，之后不再询问。

## `vp fft` — ffmpeg 音视频处理

`vp fft extract-audio [VIDEO]`（别名 `vp fft ea`）：从 mp4 里**无损**抽出原始音频流
（`-c copy`，不重编码），输出同名 `.m4a`。省略文件名时扫描当前目录让你选。

与 `vp dl --keep-audio` 的区别：后者转成 mp3（有损，兼容性好，适合送去做识别），
前者原封不动搬出音频流（无损，速度快）。

## `vp vtt` — VTT 字幕处理

- `vp vtt zip [FILE]`：两种输出模式。
  - 带 `-z`：把 YouTube 那种多行滚动字幕压成**一条 cue**，去掉说话人标记（`<v ...>`），
    同时完整保留内嵌的单词级时间戳，输出 `*.zip.vtt`。
  - 不带 `-z`：剥掉所有标签导出纯文本，每条字幕一行，输出 `*.txt`，方便人工重新分段。
- `vp vtt restamp [VTT] [TEXT]`：拿 `zip` 产出的逐词时间戳 VTT 作为时间基准，
  给人工重新分段后的纯文本逐段打上内嵌时间戳，每个段落生成一个 cue。
  默认在文本文件旁生成 `*.restamp.vtt`，`-k` 保留原始文本文件。

两个命令省略文件参数时都会扫描当前目录进入交互选择。`demo/` 下有一组示例文件可以对照效果。

典型链路：

```bash
vp dl <URL> --keep-audio         # 下载视频 + mp3
# 用识别工具产出带逐词时间戳的 VTT
vp vtt zip raw.vtt -z            # 压成单行, 保留词级时间戳
vp vtt zip raw.vtt               # 导出纯文本, 人工重新分段
vp vtt restamp raw.zip.vtt seg.txt   # 按新分段重打时间戳
```

## `vp config` — 配置管理

- `vp config show`（别名 `vp cf show` / `vp cf ls`）：打印当前所有配置。
- `vp config edit`（别名 `vp cf edit`）：默认启动内置 TUI 编辑器；`--editor` 则交互式挑一个
  系统里可用的外部编辑器（VS Code、vim 等）来编辑。

## `vp autocomplete` — shell 补全

`vp autocomplete` 会打印在 bash / zsh / PowerShell 中启用命令补全的安装步骤。

# 配置说明

## `config.yml`

配置文件位于 oclif 的配置目录下，首次运行任意命令时自动创建并打印路径：

- Windows：`%LOCALAPPDATA%\vptool\config.yml`
- macOS / Linux：`~/.config/vptool/config.yml`

采用多档案（profile）结构，`current` 指向当前生效的档案：

```yaml
current: default
profiles:
  - name: default
    documentsPath: C:\Users\you\Documents\vptool   # 工作目录, 所有下载与列举的根
    dlPrefix:                                       # 下载时可选的一级子目录候选
      - tech
      - music
    TIKHUB_IO_TOKEN: your-tikhub-token              # 抖音解析用的 API Token
```

字段含义：

- `documentsPath`：工作目录。缺省时自动定位系统「文档」目录下的 `vptool` 子目录并创建
  （Windows 走 PowerShell 读真实路径，支持目录重定向）。
- `dlPrefix`：下载前 prefix 选择菜单的候选列表，由 `vp dl`/`vp dyd` 交互过程自动积累。
- `TIKHUB_IO_TOKEN`：TikHub API Token，`vp dyd` 首次使用时会引导录入。

## `logger.json`

同目录下的 `logger.json` 控制日志输出，首次运行时落地一份默认配置。三个 transport 各自独立开关：

- `console`：pino-pretty 彩色控制台输出，默认 `info`
- `file`：pino-roll 按天滚动写入配置目录下的 `logs/app.<日期>.log`，默认 `debug`，保留 14 个文件
- `mongodb`：pino-mongodb 写库，默认关闭
- `childLoggerLevels`：正则 → 级别 的白名单，用于按模块 scope 单独调级；未被任何正则命中的
  child logger 默认 `silent`

环境变量 `SPIDER_LOG_LEVEL` 可临时覆盖所有 transport 的级别，方便临时排障：

```bash
SPIDER_LOG_LEVEL=debug vp dl <URL>
```

# 开发

```bash
npm run build       # 清理 dist 并编译 TypeScript
npm start           # 运行 ./bin/run.js
npm run debug       # 带 DEBUG=oclif:vp:dl:* 运行
npm test            # mocha (posttest 会自动跑 lint)
npm run lint        # eslint
```

技术栈：TypeScript（ESM）+ [oclif v4](https://oclif.io) + pino 日志 + prompts/pi-tui 交互层。
源码分层约定：`src/commands/` 只放命令定义与参数解析，`src/lib/` 承载核心逻辑。

<!-- commands -->
# Command Topics

* [`vp autocomplete`](docs/autocomplete.md) - Display autocomplete installation instructions.
* [`vp config`](docs/config.md) - 查看与编辑用户配置文件（支持内置 TUI 与外部编辑器）
* [`vp dl`](docs/dl.md) - 下载视频并管理本地依赖环境（基于 yt-dlp 与 ffmpeg）
* [`vp dyd`](docs/dyd.md) - 解析并下载抖音视频（可自动抽取音频）
* [`vp fft`](docs/fft.md) - 基于 ffmpeg 的音视频处理（如从视频无损抽取音频）
* [`vp help`](docs/help.md) - 显示帮助信息
* [`vp version`](docs/version.md) - 显示版本信息
* [`vp vtt`](docs/vtt.md) - 处理 VTT 字幕（单行压缩、按分段重新打时间戳等）

<!-- commandsstop -->

# License

BSL
