---
name: vp-skill
description: "调用 vp（@lppx/vptool）命令行完成视频下载、抖音视频解析下载、微信公众号文章抓取、ffmpeg 音视频处理（无损抽音频、切割、切静音、probe）与 VTT 字幕整理（单行压缩、导出纯文本、按分段重打时间戳）。当用户要下载 YouTube/Bilibili/抖音视频、抓公众号文章、处理 mp4/mp3/vtt 文件，或提到 vp / vptool 命令时使用。"
---

# vp（@lppx/vptool）

`vp` 把 yt-dlp、ffmpeg、TikHub 接口和 VTT 字幕处理收敛成一组子命令。多数命令带交互式菜单，Agent 调用时必须显式传参跳过交互，否则进程会卡在等待输入。

## 调用前检查

- `vp --version` 确认已安装；未安装时 `npm install -g @lppx/vptool`（需 Node >= 18）。
- 每次运行 `vp` 都会先打印一行配置文件路径（init hook 输出），解析结果时忽略这一行。
- 涉及下载或 ffmpeg 的命令，先跑 `vp dl check`；缺二进制时跑 `vp dl check --update` 自动安装 yt-dlp 与 ffmpeg。
- `vp config show` 查看当前配置：`documentsPath`（所有下载的根目录）、`dlPrefix`、`TIKHUB_IO_TOKEN` 是否已填。

## 交互式提示与规避方法

Agent 的终端不是 TTY，交互提示无法可靠应答。已验证：在 pwsh 里用管道给 prompts 喂输入，会带上 BOM 字符、第二个提示会挂起，所以不要用 `"..." | vp ...` 的方式应答。

会触发交互的场景和规避方法：

- 省略文件参数（`fft *`、`vtt *`）：会扫描当前目录弹出选择菜单。一律传入文件路径。
- `dl` / `dl video` 未传 `--best` 或 `--format-id`：会弹出格式选择。传 `--best` 或先用 `vp dl vmeta` 查到格式 ID 再传 `-f`。
- `douyin fetch-one-video` 未传 `--provider`：会弹出接口菜单。传 `-p <id>`。
- `wechat mp dl` 未传 `--provider`：接口多于一个时弹菜单。传 `-p tikhub-h5`。
- TikHub Token 缺失（`douyin`、`wechat`）：会弹出密码输入。先用 `vp config show` 确认 `TIKHUB_IO_TOKEN` 已配置，缺失时请用户自己执行 `vp config edit` 填写，不要替用户处理 token 明文。
- 输出文件已存在（`fft extract-audio`、`fft trim-silence`）：会询问是否覆盖。执行前先检查目标文件，存在时先征得用户同意再删除。
- 无法规避，必须交给用户在自己的终端执行的命令：
  - `vp dl` / `vp dl video` / `vp douyin fetch-one-video`：下载前一定会弹出保存目录 prefix 选择菜单，目前没有对应的参数。
  - `vp fft video-split-copy`：起止时间只能交互输入。
  - `vp dl cd`（会开子 shell）、`vp config edit`（TUI/外部编辑器）。
  - 把完整命令发给用户，由用户执行后再继续。

## 命令速查

### 视频下载 `vp dl`（yt-dlp）

- `vp dl <URL>` 等同 `vp dl video <URL>`
  - `-b, --best`：最优视频+最优音频合并，跳过格式选择
  - `-f, --format-id <id>`：指定格式 ID
  - `-o, --output <dir>`：覆盖输出根目录（默认 `documentsPath`）
  - `-k, --keep-audio`：额外抽一份 mp3，默认开启
  - `-c, --use-cookies`：从 Firefox 读 cookies，默认开启（没有 `--no-` 形式，无法关闭）
  - 产物：`<output>/<prefix>/<站点域名>/<视频标题>.<ext>`
- `vp dl sub <URL>`：只下载字幕（含 YouTube 自动生成字幕），vtt 优先
  - `-l, --lang <codes>`：语言代码，逗号分隔（如 `en,zh-Hans`），省略时弹出多选菜单
  - `--no-auto`：只下载人工字幕；默认包含自动字幕，同一语言两种都有时 yt-dlp 优先取人工字幕
  - `-o, --output <dir>`：输出目录，默认是执行命令时的当前目录（不走 `documentsPath`，也不选 prefix）
  - `-c, --use-cookies`：默认开启
  - 产物：`<output>/<视频标题>.<lang>.vtt`，每个文件打印一行 `✓ 已保存: <路径>`；语言不存在时只打印警告，不报错
  - 传了 `-l` 就没有交互，Agent 可以直接执行。不知道有哪些语言时，把不带 `-l` 的命令交给用户执行
- `vp dl vmeta <URL>`：只看标题、时长、可用格式，不下载，无交互，适合 Agent 直接调用。
- `vp dl check [-u]`：检查 yt-dlp/ffmpeg 路径与版本，`-u` 下载缺失的二进制。
- `vp dl updatebin`：升级 yt-dlp。下载报错（站点接口变化）时先跑它再重试。
- `vp dl list [-p]`：递归列出 `documentsPath` 下的文件，`-p` 输出完整路径。找下载产物时用它。
- `vp dl open`：用系统文件管理器打开 `documentsPath`。

### 抖音 `vp douyin`

- `vp douyin fetch-one-video <链接或整段分享文案>`（别名 `vp dy fov`）
  - `-p, --provider`：`app-v1` / `app-v2` / `app-v3` / `app-share` / `web-share` / `web-v2` / `web-v1`
  - `-o, --output <dir>`、`-k, --keep-audio`（默认开启）
  - 产物：`<output>/<prefix>/douyin.com/<视频名>/<视频名>.mp4`
  - 某个 provider 失败时换一个重试；`app-v3` 可绕过版权限制，`web-share` 画质更高。

### 微信公众号 `vp wechat mp`

- `vp wechat mp dl <URL>`（别名 `vp wx mp dl` / `vp mp dl`）
  - `-p, --provider`：`tikhub-h5`（字段最全，推荐）/ `tikhub`（更快）
  - `-o, --output <dir>`：覆盖根目录
  - 产物：`<output>/1111微信公众号/<公众号昵称>/<YYYY-MM-DD 标题>.txt`，路径在输出的 `✅ 文章已保存:` 行
- `vp wechat mp opendir`（别名 `vp mp open`）：打开文章目录。

### ffmpeg 处理 `vp fft`

所有命令都在源文件旁生成产物，不修改源文件。

- `vp fft extract-audio <video.mp4>`（`vp fft ea`）：无损抽出音频流，生成同名 `.m4a`。
- `vp fft probe <media>`（`vp fft pb`）：打印 ffprobe 信息（时长、编码、码率、流信息），无副作用。
- `vp fft trim-silence <audio>`（`vp fft ts`）：切掉静音，只保留说话部分，生成 `<名称>.trimmed.<ext>`。仅支持纯音频（mp3/m4a/aac/wav/flac/ogg/opus/wma）。
  - `--threshold`：静音阈值，默认 `-30dB`（只写数字时自动补 dB）
  - `--min-silence`：最短静音秒数，默认 `0.5`
  - `--padding`：语音首尾保留秒数，默认 `0.1`
  - 负数参数用等号写法：`--threshold=-40dB`
- `vp fft video-split-copy <video>`（`vp fft vsc`）：无损切割，生成 `<名称>.cut_<起>-<止>s.<ext>`。起止时间只能交互输入，交给用户执行。

### VTT 字幕 `vp vtt`

- `vp vtt zip <file.vtt>`：导出纯文本（每条字幕一行），生成 `<名称>.txt`，用于人工重新分段。
- `vp vtt zip <file.vtt> -z`：压成单行 cue，去掉 `<v ...>` 说话人标记并保留逐词时间戳，生成 `<名称>.zip.vtt`。
- `vp vtt restamp <file.zip.vtt> <seg.txt>`：用逐词时间戳 VTT 给重新分段的文本打时间戳，每段一个 cue，生成 `<seg>.restamp.vtt`。
  - 注意：默认会删除输入的 txt，想保留必须加 `-k`。除非用户明确不要原文本，否则一律加 `-k`。
- 两个命令都支持 `-o <path>` 指定输出路径，成功时输出 `已生成: <路径>`。

### 配置 `vp config`

- `vp config show`（`vp cf ls`）：打印配置文件路径和原始 YAML。输出里有 `TIKHUB_IO_TOKEN` 明文，转述给用户时只说明是否已配置，不要复述 token 值。
- `vp config edit`：交互式编辑，交给用户执行。
- 配置文件位置：Windows `%LOCALAPPDATA%\vptool\config.yml`，macOS/Linux `~/.config/vptool/config.yml`。

## 典型流程

字幕整理（全部可由 Agent 执行）：

```bash
vp vtt zip raw.vtt -z                        # 得到 raw.zip.vtt（逐词时间戳）
vp vtt zip raw.vtt                           # 得到 raw.txt，交给人工或 AI 重新分段
vp vtt restamp raw.zip.vtt raw.txt -k        # 得到 raw.restamp.vtt
```

音频预处理（用于语音识别）：

```bash
vp fft probe input.mp4
vp fft extract-audio input.mp4               # 得到 input.m4a
vp fft trim-silence input.m4a --threshold=-35dB
```

视频下载：先由 Agent 跑 `vp dl vmeta <URL>` 确认可解析并挑好格式，再把 `vp dl <URL> --best`（或 `-f <id>`）交给用户执行，用户完成后用 `vp dl list -p` 定位产物。

## 排错

- 调试日志：设置环境变量 `SPIDER_LOG_LEVEL=debug` 后重跑（pwsh：`$env:SPIDER_LOG_LEVEL='debug'; vp ...`）。日志文件在配置目录的 `logs/app.<日期>.log`。
- yt-dlp 下载或解析失败：先 `vp dl updatebin`，登录内容需要 Firefox 已登录对应站点。
- 找不到 ffmpeg/yt-dlp：`vp dl check --update`。
- 命令拼错时 oclif 会给出相近命令提示；查看某个命令完整参数用 `vp <topic> <command> --help`。
