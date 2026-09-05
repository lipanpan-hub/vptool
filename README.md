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
* [`vp autocomplete [SHELL]`](#vp-autocomplete-shell)
* [`vp cf edit`](#vp-cf-edit)
* [`vp cf ls`](#vp-cf-ls)
* [`vp cf show`](#vp-cf-show)
* [`vp config edit`](#vp-config-edit)
* [`vp config show`](#vp-config-show)
* [`vp dl URL`](#vp-dl-url)
* [`vp dl cd [X]`](#vp-dl-cd-x)
* [`vp dl check`](#vp-dl-check)
* [`vp dl list`](#vp-dl-list)
* [`vp dl open`](#vp-dl-open)
* [`vp dl updatebin`](#vp-dl-updatebin)
* [`vp dl video URL`](#vp-dl-video-url)
* [`vp dl vmeta URL`](#vp-dl-vmeta-url)
* [`vp dyd fetch-one-video INPUT`](#vp-dyd-fetch-one-video-input)
* [`vp dyd fov INPUT`](#vp-dyd-fov-input)
* [`vp fft ea [VIDEO]`](#vp-fft-ea-video)
* [`vp fft extract-audio [VIDEO]`](#vp-fft-extract-audio-video)
* [`vp fft pb [MEDIA]`](#vp-fft-pb-media)
* [`vp fft probe [MEDIA]`](#vp-fft-probe-media)
* [`vp fft video-split-copy [VIDEO]`](#vp-fft-video-split-copy-video)
* [`vp fft vsc [VIDEO]`](#vp-fft-vsc-video)
* [`vp help [COMMAND]`](#vp-help-command)
* [`vp version`](#vp-version)
* [`vp vtt restamp [VTT] [TEXT]`](#vp-vtt-restamp-vtt-text)
* [`vp vtt zip [FILE]`](#vp-vtt-zip-file)

## `vp autocomplete [SHELL]`

Display autocomplete installation instructions.

```
USAGE
  $ vp autocomplete [SHELL] [-r]

ARGUMENTS
  [SHELL]  (zsh|bash|powershell) Shell type

FLAGS
  -r, --refresh-cache  Refresh cache (ignores displaying instructions)

DESCRIPTION
  Display autocomplete installation instructions.

EXAMPLES
  $ vp autocomplete

  $ vp autocomplete bash

  $ vp autocomplete zsh

  $ vp autocomplete powershell

  $ vp autocomplete --refresh-cache
```

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v4.0.0/src/commands/autocomplete/index.ts)_

## `vp cf edit`

编辑用户配置文件, 默认启动内置 TUI 编辑器, 也可选择系统中的外部编辑器

```
USAGE
  $ vp cf edit [-e]

FLAGS
  -e, --editor  交互式选择系统中可用的外部编辑器进行编辑

DESCRIPTION
  编辑用户配置文件, 默认启动内置 TUI 编辑器, 也可选择系统中的外部编辑器

ALIASES
  $ vp cf edit

EXAMPLES
  $ vp cf edit

  $ vp cf edit --editor
```

## `vp cf ls`

列出所有的配置

```
USAGE
  $ vp cf ls

DESCRIPTION
  列出所有的配置

ALIASES
  $ vp cf ls
  $ vp cf show

EXAMPLES
  $ vp cf ls
```

## `vp cf show`

列出所有的配置

```
USAGE
  $ vp cf show

DESCRIPTION
  列出所有的配置

ALIASES
  $ vp cf ls
  $ vp cf show

EXAMPLES
  $ vp cf show
```

## `vp config edit`

编辑用户配置文件, 默认启动内置 TUI 编辑器, 也可选择系统中的外部编辑器

```
USAGE
  $ vp config edit [-e]

FLAGS
  -e, --editor  交互式选择系统中可用的外部编辑器进行编辑

DESCRIPTION
  编辑用户配置文件, 默认启动内置 TUI 编辑器, 也可选择系统中的外部编辑器

ALIASES
  $ vp cf edit

EXAMPLES
  $ vp config edit

  $ vp config edit --editor
```

_See code: [src/commands/config/edit.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/config/edit.ts)_

## `vp config show`

列出所有的配置

```
USAGE
  $ vp config show

DESCRIPTION
  列出所有的配置

ALIASES
  $ vp cf ls
  $ vp cf show

EXAMPLES
  $ vp config show
```

_See code: [src/commands/config/show.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/config/show.ts)_

## `vp dl URL`

下载视频（支持交互式选择格式）

```
USAGE
  $ vp dl URL [-b] [-f <value>] [-k] [-o <value>] [-c]

ARGUMENTS
  URL  视频链接

FLAGS
  -b, --best               直接下载最优视频+最优音频并合并（跳过交互式选择，需要 ffmpeg）
  -c, --use-cookies        从 Firefox 浏览器获取 cookies
  -f, --format-id=<value>  指定格式ID（跳过交互式选择）
  -k, --keep-audio         在下载视频的同时额外抽取一份 mp3 音频文件（用于语音识别等，需要 ffmpeg）
  -o, --output=<value>     输出目录（默认为配置文件中的 documentsDir）

DESCRIPTION
  下载视频（支持交互式选择格式）

EXAMPLES
  $ vp dl https://www.youtube.com/watch?v=dQw4w9WgXcQ

  $ vp dl https://www.bilibili.com/video/BV1xx411c7mu -o ~/Downloads

  $ vp dl https://www.youtube.com/watch?v=dQw4w9WgXcQ --format-id 22

  $ vp dl https://www.youtube.com/watch?v=dQw4w9WgXcQ --best

  $ vp dl https://www.youtube.com/watch?v=dQw4w9WgXcQ --best --keep-audio
```

_See code: [src/commands/dl/index.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/dl/index.ts)_

## `vp dl cd [X]`

在 documentsPath 下交互式选择并进入一个目录

```
USAGE
  $ vp dl cd [X]

ARGUMENTS
  [X]  要进入的目录路径（支持模糊匹配）

DESCRIPTION
  在 documentsPath 下交互式选择并进入一个目录

EXAMPLES
  $ vp dl cd

  $ vp dl cd mydir
```

_See code: [src/commands/dl/cd.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/dl/cd.ts)_

## `vp dl check`

检查基础环境是否就绪（打印 yt-dlp 与 ffmpeg 的路径和版本）

```
USAGE
  $ vp dl check [-u]

FLAGS
  -u, --update  下载并更新所需的二进制 (yt-dlp 与 ffmpeg)

DESCRIPTION
  检查基础环境是否就绪（打印 yt-dlp 与 ffmpeg 的路径和版本）

EXAMPLES
  $ vp dl check

  $ vp dl check --update
```

_See code: [src/commands/dl/check.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/dl/check.ts)_

## `vp dl list`

递归列出配置文件中 documentsPath 指定目录下的所有文件和文件夹

```
USAGE
  $ vp dl list [-p]

FLAGS
  -p, --path  显示文件和文件夹的完整路径

DESCRIPTION
  递归列出配置文件中 documentsPath 指定目录下的所有文件和文件夹

EXAMPLES
  $ vp dl list

  $ vp dl list --path
```

_See code: [src/commands/dl/list.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/dl/list.ts)_

## `vp dl open`

打开配置文件中 documentsPath 指定的目录

```
USAGE
  $ vp dl open

DESCRIPTION
  打开配置文件中 documentsPath 指定的目录

EXAMPLES
  $ vp dl open
```

_See code: [src/commands/dl/open.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/dl/open.ts)_

## `vp dl updatebin`

将本地 yt-dlp 二进制更新到最新版本

```
USAGE
  $ vp dl updatebin

DESCRIPTION
  将本地 yt-dlp 二进制更新到最新版本

EXAMPLES
  $ vp dl updatebin
```

_See code: [src/commands/dl/updatebin.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/dl/updatebin.ts)_

## `vp dl video URL`

下载视频（支持交互式选择格式）

```
USAGE
  $ vp dl video URL [-b] [-f <value>] [-k] [-o <value>] [-c]

ARGUMENTS
  URL  视频链接

FLAGS
  -b, --best               直接下载最优视频+最优音频并合并（跳过交互式选择，需要 ffmpeg）
  -c, --use-cookies        从 Firefox 浏览器获取 cookies
  -f, --format-id=<value>  指定格式ID（跳过交互式选择）
  -k, --keep-audio         在下载视频的同时额外抽取一份 mp3 音频文件（用于语音识别等，需要 ffmpeg）
  -o, --output=<value>     输出目录（默认为配置文件中的 documentsDir）

DESCRIPTION
  下载视频（支持交互式选择格式）

EXAMPLES
  $ vp dl video https://www.youtube.com/watch?v=dQw4w9WgXcQ

  $ vp dl video https://www.bilibili.com/video/BV1xx411c7mu -o ~/Downloads

  $ vp dl video https://www.youtube.com/watch?v=dQw4w9WgXcQ --format-id 22

  $ vp dl video https://www.youtube.com/watch?v=dQw4w9WgXcQ --best

  $ vp dl video https://www.youtube.com/watch?v=dQw4w9WgXcQ --best --keep-audio
```

_See code: [src/commands/dl/video.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/dl/video.ts)_

## `vp dl vmeta URL`

获取视频元信息

```
USAGE
  $ vp dl vmeta URL [-c]

ARGUMENTS
  URL  视频链接

FLAGS
  -c, --use-cookies  从 Firefox 浏览器获取 cookies（用于访问需要登录的内容）

DESCRIPTION
  获取视频元信息

EXAMPLES
  $ vp dl vmeta https://www.youtube.com/watch?v=dQw4w9WgXcQ

  $ vp dl vmeta https://www.bilibili.com/video/BV1xx411c7mu

  $ vp dl vmeta https://www.youtube.com/watch?v=dQw4w9WgXcQ --use-cookies
```

_See code: [src/commands/dl/vmeta.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/dl/vmeta.ts)_

## `vp dyd fetch-one-video INPUT`

解析并下载单个抖音视频(通过 TikHub 接口), 下载后自动抽取音频

```
USAGE
  $ vp dyd fetch-one-video INPUT [-k] [-o <value>] [-p app-v1|app-v2|app-v3|app-share|web-share|web-v2|web-v1]

ARGUMENTS
  INPUT  抖音视频链接或分享文案

FLAGS
  -k, --keep-audio         下载视频后额外抽取一份 mp3 音频(需要 ffmpeg)
  -o, --output=<value>     输出目录(默认为配置文件中的 documentsPath)
  -p, --provider=<option>  指定解析接口(不指定则进入交互式选择菜单)
                           <options: app-v1|app-v2|app-v3|app-share|web-share|web-v2|web-v1>

DESCRIPTION
  解析并下载单个抖音视频(通过 TikHub 接口), 下载后自动抽取音频

ALIASES
  $ vp dyd fov

EXAMPLES
  $ vp dyd fetch-one-video https://v.douyin.com/xxxxxxx/

  $ vp dyd fetch-one-video "8.99 复制打开抖音 https://v.douyin.com/xxxxxxx/ ..."

  $ vp dyd fetch-one-video https://v.douyin.com/xxxxxxx/ --provider app-v3
```

_See code: [src/commands/dyd/fetch-one-video.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/dyd/fetch-one-video.ts)_

## `vp dyd fov INPUT`

解析并下载单个抖音视频(通过 TikHub 接口), 下载后自动抽取音频

```
USAGE
  $ vp dyd fov INPUT [-k] [-o <value>] [-p app-v1|app-v2|app-v3|app-share|web-share|web-v2|web-v1]

ARGUMENTS
  INPUT  抖音视频链接或分享文案

FLAGS
  -k, --keep-audio         下载视频后额外抽取一份 mp3 音频(需要 ffmpeg)
  -o, --output=<value>     输出目录(默认为配置文件中的 documentsPath)
  -p, --provider=<option>  指定解析接口(不指定则进入交互式选择菜单)
                           <options: app-v1|app-v2|app-v3|app-share|web-share|web-v2|web-v1>

DESCRIPTION
  解析并下载单个抖音视频(通过 TikHub 接口), 下载后自动抽取音频

ALIASES
  $ vp dyd fov

EXAMPLES
  $ vp dyd fov https://v.douyin.com/xxxxxxx/

  $ vp dyd fov "8.99 复制打开抖音 https://v.douyin.com/xxxxxxx/ ..."

  $ vp dyd fov https://v.douyin.com/xxxxxxx/ --provider app-v3
```

## `vp fft ea [VIDEO]`

从 mp4 中无损抽取原始音频流(不重编码), 输出同名 m4a 文件

```
USAGE
  $ vp fft ea [VIDEO]

ARGUMENTS
  [VIDEO]  源 mp4 文件(省略则扫描当前目录交互选择)

DESCRIPTION
  从 mp4 中无损抽取原始音频流(不重编码), 输出同名 m4a 文件

ALIASES
  $ vp fft ea

EXAMPLES
  $ vp fft ea input.mp4

  $ vp fft ea
```

## `vp fft extract-audio [VIDEO]`

从 mp4 中无损抽取原始音频流(不重编码), 输出同名 m4a 文件

```
USAGE
  $ vp fft extract-audio [VIDEO]

ARGUMENTS
  [VIDEO]  源 mp4 文件(省略则扫描当前目录交互选择)

DESCRIPTION
  从 mp4 中无损抽取原始音频流(不重编码), 输出同名 m4a 文件

ALIASES
  $ vp fft ea

EXAMPLES
  $ vp fft extract-audio input.mp4

  $ vp fft extract-audio
```

_See code: [src/commands/fft/extract-audio.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/fft/extract-audio.ts)_

## `vp fft pb [MEDIA]`

调用 ffprobe 查看音视频文件的详细信息, 以人类可读方式输出

```
USAGE
  $ vp fft pb [MEDIA]

ARGUMENTS
  [MEDIA]  音视频文件路径(省略则扫描当前目录交互选择)

DESCRIPTION
  调用 ffprobe 查看音视频文件的详细信息, 以人类可读方式输出

ALIASES
  $ vp fft pb

EXAMPLES
  $ vp fft pb input.mp4

  $ vp fft pb
```

## `vp fft probe [MEDIA]`

调用 ffprobe 查看音视频文件的详细信息, 以人类可读方式输出

```
USAGE
  $ vp fft probe [MEDIA]

ARGUMENTS
  [MEDIA]  音视频文件路径(省略则扫描当前目录交互选择)

DESCRIPTION
  调用 ffprobe 查看音视频文件的详细信息, 以人类可读方式输出

ALIASES
  $ vp fft pb

EXAMPLES
  $ vp fft probe input.mp4

  $ vp fft probe
```

_See code: [src/commands/fft/probe.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/fft/probe.ts)_

## `vp fft video-split-copy [VIDEO]`

对 mp4 进行无损快速切割(不重编码), 按指定起止时间输出片段

```
USAGE
  $ vp fft video-split-copy [VIDEO]

ARGUMENTS
  [VIDEO]  源 mp4 文件(省略则扫描当前目录交互选择)

DESCRIPTION
  对 mp4 进行无损快速切割(不重编码), 按指定起止时间输出片段

ALIASES
  $ vp fft vsc

EXAMPLES
  $ vp fft video-split-copy input.mp4

  $ vp fft video-split-copy
```

_See code: [src/commands/fft/video-split-copy.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/fft/video-split-copy.ts)_

## `vp fft vsc [VIDEO]`

对 mp4 进行无损快速切割(不重编码), 按指定起止时间输出片段

```
USAGE
  $ vp fft vsc [VIDEO]

ARGUMENTS
  [VIDEO]  源 mp4 文件(省略则扫描当前目录交互选择)

DESCRIPTION
  对 mp4 进行无损快速切割(不重编码), 按指定起止时间输出片段

ALIASES
  $ vp fft vsc

EXAMPLES
  $ vp fft vsc input.mp4

  $ vp fft vsc
```

## `vp help [COMMAND]`

Display help for vp.

```
USAGE
  $ vp help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for vp.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/7.0.0/src/commands/help.ts)_

## `vp version`

```
USAGE
  $ vp version [--json] [--verbose]

FLAGS
  --verbose  Show additional information about the CLI.

GLOBAL FLAGS
  --json  Format output as json.

FLAG DESCRIPTIONS
  --verbose  Show additional information about the CLI.

    Additionally shows the architecture, node version, operating system, and versions of plugins that the CLI is using.
```

_See code: [@oclif/plugin-version](https://github.com/oclif/plugin-version/blob/3.0.0/src/commands/version.ts)_

## `vp vtt restamp [VTT] [TEXT]`

依据源 VTT 的逐词时间戳,为重新分段的文本逐段打上内嵌时间戳,每个段落生成一个 cue

```
USAGE
  $ vp vtt restamp [VTT] [TEXT] [-k] [-o <value>]

ARGUMENTS
  [VTT]   含逐词时间戳的源 VTT 文件(省略则扫描当前目录交互选择)
  [TEXT]  重新分段后的纯文本文件(省略则扫描当前目录交互选择)

FLAGS
  -k, --keep            保留原始文本文件(默认生成后删除)
  -o, --output=<value>  输出文件路径(默认在文本文件旁生成 *.restamp.vtt)

DESCRIPTION
  依据源 VTT 的逐词时间戳,为重新分段的文本逐段打上内嵌时间戳,每个段落生成一个 cue

EXAMPLES
  $ vp vtt restamp demo.zip.vtt demo2.txt

  $ vp vtt restamp demo.zip.vtt demo2.txt -o out.vtt
```

_See code: [src/commands/vtt/restamp.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/vtt/restamp.ts)_

## `vp vtt zip [FILE]`

将 VTT 多行字幕压缩为单行,去除说话人信息并完整保留单词级时间戳

```
USAGE
  $ vp vtt zip [FILE] [-o <value>] [-z]

ARGUMENTS
  [FILE]  VTT 字幕文件路径(省略则从当前目录交互选择)

FLAGS
  -o, --output=<value>  输出文件路径(默认在原文件旁生成 *.zip.vtt 或 *.txt)
  -z, --zip             压缩成单行字幕:去除说话人信息并完整保留单词级时间戳

DESCRIPTION
  将 VTT 多行字幕压缩为单行,去除说话人信息并完整保留单词级时间戳

EXAMPLES
  $ vp vtt zip demo.vtt

  $ vp vtt zip demo.vtt -o out.txt

  $ vp vtt zip demo.vtt -z

  $ vp vtt zip
```

_See code: [src/commands/vtt/zip.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/vtt/zip.ts)_
<!-- commandsstop -->

# License

BSL
