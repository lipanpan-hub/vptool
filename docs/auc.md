`vp auc`
========

管理 audiocpp 语音服务（启停 audiocpp_server、模型装卸、语音转写/字幕/合成）

* [`vp auc asr [FILE]`](#vp-auc-asr-file)
* [`vp auc cfset DIR`](#vp-auc-cfset-dir)
* [`vp auc dub [VTT]`](#vp-auc-dub-vtt)
* [`vp auc load DIR`](#vp-auc-load-dir)
* [`vp auc models`](#vp-auc-models)
* [`vp auc run`](#vp-auc-run)
* [`vp auc start`](#vp-auc-start)
* [`vp auc stop`](#vp-auc-stop)
* [`vp auc sub [FILE]`](#vp-auc-sub-file)
* [`vp auc tts TEXT`](#vp-auc-tts-text)
* [`vp auc unload MODELID`](#vp-auc-unload-modelid)
* [`vp auc use [DIR]`](#vp-auc-use-dir)
* [`vp auc voices`](#vp-auc-voices)

## `vp auc asr [FILE]`

语音转文字 + 词级对齐(原始数据存同名 .json, 自动 ffmpeg 预处理为 16kHz 单声道; 不传文件时交互式选择)

```
USAGE
  $ vp auc asr [FILE] [--json] [--model <value>] [--align-model <value>] [--language <value>] [--out <value>]
    [--port <value>] [--auto-load]

ARGUMENTS
  [FILE]  音视频文件路径(省略则交互选择)

FLAGS
  --align-model=<value>  [default: qwen3_forced_aligner] 强制对齐模型 id
  --auto-load            自动装载所需模型(卸载其他已加载模型, 再装载 ASR 与对齐模型)
  --language=<value>     [default: zh] 音频语言代码
  --model=<value>        [default: qwen3_asr] ASR 模型 id
  --out=<value>          纯文本输出路径(缺省打印到终端)
  --port=<value>         [default: 8080] 服务监听端口(需与启动时一致)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  语音转文字 + 词级对齐(原始数据存同名 .json, 自动 ffmpeg 预处理为 16kHz 单声道; 不传文件时交互式选择)

EXAMPLES
  $ vp auc asr video.mp4

  $ vp auc asr audio.wav --language zh --out transcript.txt

  $ vp auc asr
```

_See code: [src/commands/auc/asr.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/auc/asr.ts)_

## `vp auc cfset DIR`

设置 audiocpp 包的目录路径到配置文件(写入当前配置档案的 audioCppDir 字段)

```
USAGE
  $ vp auc cfset DIR [--json]

ARGUMENTS
  DIR  audiocpp 包的目录路径

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  设置 audiocpp 包的目录路径到配置文件(写入当前配置档案的 audioCppDir 字段)

EXAMPLES
  $ vp auc cfset E:/tools/audiocpp
```

_See code: [src/commands/auc/cfset.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/auc/cfset.ts)_

## `vp auc dub [VTT]`

为 VTT 字幕逐条配音并按时间轴拼接成完整配音音轨(本地 IndexTTS2.5): 自动确保服务已启动(未启动则拉起), 且装载的是 IndexTTS2.5(不是则卸载其他模型后换装); 单条配音超出字幕时长时拼接用 ffmpeg atempo 变速不变调(最高 3 倍), 仍超出则截断; 单条合成失败即中止, 重跑凭缓存续跑

```
USAGE
  $ vp auc dub [VTT] [--json] [--backend <value>] [--language <value>] [-o <value>] [--port <value>]
    [--reference-text <value>] [--voice <value>] [-r <value>]

ARGUMENTS
  [VTT]  VTT 字幕文件路径(省略则交互选择当前目录 .vtt)

FLAGS
  -o, --outdir=<value>          输出目录, 省略时输出到字幕所在目录
  -r, --voice-ref=<value>       参考音频 wav 路径, 克隆其音色, 优先于 --voice
      --backend=<value>         [default: cuda] 计算后端(仅服务未启动需要拉起时生效)
      --language=<value>        [default: zh] 配音文本语言
      --port=<value>            [default: 8080] 服务监听端口(需与启动时一致)
      --reference-text=<value>  参考音频里说的文字, 仅配合 --voice-ref 使用, 可省略
      --voice=<value>           [default: demo_1_man] 服务内置音色名(可用 vp auc voices 查询); 指定 --voice-ref 时忽略

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  为 VTT 字幕逐条配音并按时间轴拼接成完整配音音轨(本地 IndexTTS2.5): 自动确保服务已启动(未启动则拉起), 且装载的是
  IndexTTS2.5(不是则卸载其他模型后换装); 单条配音超出字幕时长时拼接用 ffmpeg atempo 变速不变调(最高 3 倍), 仍超出则截断;
  单条合成失败即中止, 重跑凭缓存续跑

EXAMPLES
  $ vp auc dub "video.zh.vtt"

  $ vp auc dub "video.zh.vtt" --voice demo_3_woman

  $ vp auc dub video.zh.vtt -r me.wav --outdir out
```

_See code: [src/commands/auc/dub.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/auc/dub.ts)_

## `vp auc load DIR`

装载模型到 audiocpp_server(从模型包目录自动推导 family/task/权重路径)

```
USAGE
  $ vp auc load DIR [--json] [--package <value>] [--id <value>] [--set <value>...] [--port <value>]

ARGUMENTS
  DIR  模型包目录

FLAGS
  --id=<value>       模型 id(默认取 family)
  --package=<value>  包 id(目录内含多个包时必填)
  --port=<value>     [default: 8080] 服务监听端口(需与启动时一致)
  --set=<value>...   session_options 键值对 key=value, 可重复

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  装载模型到 audiocpp_server(从模型包目录自动推导 family/task/权重路径)

EXAMPLES
  $ vp auc load E:/tools/audiocpp/models/Qwen3-ASR-1.7B-GGUF

  $ vp auc load E:/tools/audiocpp/models/IndexTTS2-GGUF

  $ vp auc load E:/tools/audiocpp/models/AuK-Base-and-Flash-GGUF --package auk_qwen_q8_0 --set some.option=value
```

_See code: [src/commands/auc/load.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/auc/load.ts)_

## `vp auc models`

列出 audiocpp_server 已注册的模型及加载状态

```
USAGE
  $ vp auc models [--json] [--port <value>]

FLAGS
  --port=<value>  [default: 8080] 服务监听端口(需与启动时一致)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  列出 audiocpp_server 已注册的模型及加载状态

EXAMPLES
  $ vp auc models
```

_See code: [src/commands/auc/models.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/auc/models.ts)_

## `vp auc run`

后台启动 audiocpp_server 服务并等待就绪(服务目录取配置档案的 audioCppDir 字段); 就绪后装载指定模型(已加载的其他模型先卸载, 目标已装载则跳过), 未指定 --model 时交互式选择

```
USAGE
  $ vp auc run [--json] [--port <value>] [--backend <value>] [--model <value>] [--package <value>]

FLAGS
  --backend=<value>  [default: cuda] 计算后端
  --model=<value>    就绪后装载的模型包目录(models 下目录名或绝对路径), 已加载的其他模型会先卸载; 缺省进入交互式选择
  --package=<value>  包 id(仅 --model 目录内含多个包时必填)
  --port=<value>     [default: 8080] 服务监听端口

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  后台启动 audiocpp_server 服务并等待就绪(服务目录取配置档案的 audioCppDir 字段);
  就绪后装载指定模型(已加载的其他模型先卸载, 目标已装载则跳过), 未指定 --model 时交互式选择

ALIASES
  $ vp auc start
  $ vp auc run

EXAMPLES
  $ vp auc run

  $ vp auc run --port 8081 --backend cpu

  $ vp auc run --model Qwen3-ASR-1.7B-GGUF
```

## `vp auc start`

后台启动 audiocpp_server 服务并等待就绪(服务目录取配置档案的 audioCppDir 字段); 就绪后装载指定模型(已加载的其他模型先卸载, 目标已装载则跳过), 未指定 --model 时交互式选择

```
USAGE
  $ vp auc start [--json] [--port <value>] [--backend <value>] [--model <value>] [--package <value>]

FLAGS
  --backend=<value>  [default: cuda] 计算后端
  --model=<value>    就绪后装载的模型包目录(models 下目录名或绝对路径), 已加载的其他模型会先卸载; 缺省进入交互式选择
  --package=<value>  包 id(仅 --model 目录内含多个包时必填)
  --port=<value>     [default: 8080] 服务监听端口

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  后台启动 audiocpp_server 服务并等待就绪(服务目录取配置档案的 audioCppDir 字段);
  就绪后装载指定模型(已加载的其他模型先卸载, 目标已装载则跳过), 未指定 --model 时交互式选择

ALIASES
  $ vp auc start
  $ vp auc run

EXAMPLES
  $ vp auc start

  $ vp auc start --port 8081 --backend cpu

  $ vp auc start --model Qwen3-ASR-1.7B-GGUF
```

_See code: [src/commands/auc/start.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/auc/start.ts)_

## `vp auc stop`

停止 audiocpp_server 服务(按监听端口定位进程并终止, 服务目录取配置档案的 audioCppDir 字段)

```
USAGE
  $ vp auc stop [--json] [--port <value>]

FLAGS
  --port=<value>  [default: 8080] 服务监听端口(需与启动时一致)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  停止 audiocpp_server 服务(按监听端口定位进程并终止, 服务目录取配置档案的 audioCppDir 字段)

EXAMPLES
  $ vp auc stop

  $ vp auc stop --port 8081
```

_See code: [src/commands/auc/stop.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/auc/stop.ts)_

## `vp auc sub [FILE]`

为音视频生成字幕文件(转写 + 强制对齐, 整段单条输出 VTT/SRT 不分段, 需已装载 ASR 与对齐模型; 不传文件时交互式选择)

```
USAGE
  $ vp auc sub [FILE] [--json] [--model <value>] [--align-model <value>] [--language <value>] [--format
    <value>] [--out <value>] [--txt] [--vttflow] [--port <value>] [--auto-load]

ARGUMENTS
  [FILE]  音视频文件路径(省略则交互选择)

FLAGS
  --align-model=<value>  [default: qwen3_forced_aligner] 强制对齐模型 id
  --auto-load            自动装载所需模型(卸载其他已加载模型, 再装载 ASR 与对齐模型)
  --format=<value>       [default: vtt] 字幕格式: vtt | srt
  --language=<value>     [default: zh] 音频语言代码
  --model=<value>        [default: qwen3_asr] ASR 模型 id
  --out=<value>          字幕输出路径(缺省与源文件同名)
  --port=<value>         [default: 8080] 服务监听端口(需与启动时一致)
  --txt                  同时生成同名 txt 纯文本文档(整段)
  --vttflow              输出到当前目录 .vttflow 目录(自动创建), 文件名为 默认名.step1-raw.vtt/.txt

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  为音视频生成字幕文件(转写 + 强制对齐, 整段单条输出 VTT/SRT 不分段, 需已装载 ASR 与对齐模型; 不传文件时交互式选择)

EXAMPLES
  $ vp auc sub video.mp4

  $ vp auc sub video.mp4 --format srt

  $ vp auc sub video.mp4 --auto-load

  $ vp auc sub video.mp4 --vttflow

  $ vp auc sub
```

_See code: [src/commands/auc/sub.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/auc/sub.ts)_

## `vp auc tts TEXT`

文字转语音(需已装载 TTS 模型, 可指定参考音色克隆音色)

```
USAGE
  $ vp auc tts TEXT [--json] [--model <value>] [--language <value>] [--voice <value>] [--out <value>]
    [--format <value>] [--port <value>]

ARGUMENTS
  TEXT  要合成的文本

FLAGS
  --format=<value>    [default: wav] 音频格式
  --language=<value>  [default: zh] 合成语言代码
  --model=<value>     [default: index_tts2] TTS 模型 id
  --out=<value>       [default: tts-output.wav] 音频输出路径
  --port=<value>      [default: 8080] 服务监听端口(需与启动时一致)
  --voice=<value>     参考音色 wav 文件路径(音色克隆)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  文字转语音(需已装载 TTS 模型, 可指定参考音色克隆音色)

EXAMPLES
  $ vp auc tts "你好, 世界"

  $ vp auc tts "你好, 世界" --voice demo_1_man --out hello.wav
```

_See code: [src/commands/auc/tts.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/auc/tts.ts)_

## `vp auc unload MODELID`

卸载 audiocpp_server 上的模型以释放显存

```
USAGE
  $ vp auc unload MODELID [--json] [--port <value>]

ARGUMENTS
  MODELID  模型 id(见 vp auc models)

FLAGS
  --port=<value>  [default: 8080] 服务监听端口(需与启动时一致)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  卸载 audiocpp_server 上的模型以释放显存

EXAMPLES
  $ vp auc unload qwen3_asr
```

_See code: [src/commands/auc/unload.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/auc/unload.ts)_

## `vp auc use [DIR]`

一键切换加载的模型(卸载全部已加载模型后装载目标模型; 目标已装载时跳过; 切换到 ASR 模型时自动伴随装载对齐模型; 不传目录时交互式选择)

```
USAGE
  $ vp auc use [DIR] [--json] [--package <value>] [--port <value>]

ARGUMENTS
  [DIR]  目标模型包目录(缺省进入交互式选择)

FLAGS
  --package=<value>  包 id(仅传目录时, 目录内含多个包时必填)
  --port=<value>     [default: 8080] 服务监听端口(需与启动时一致)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  一键切换加载的模型(卸载全部已加载模型后装载目标模型; 目标已装载时跳过; 切换到 ASR 模型时自动伴随装载对齐模型;
  不传目录时交互式选择)

EXAMPLES
  $ vp auc use

  $ vp auc use IndexTTS2-GGUF

  $ vp auc use Qwen3-ASR-1.7B-GGUF
```

_See code: [src/commands/auc/use.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/auc/use.ts)_

## `vp auc voices`

列出 audiocpp_server 共享参考音色库中的音色

```
USAGE
  $ vp auc voices [--json] [--model <value>] [--port <value>]

FLAGS
  --model=<value>  [default: index_tts2] TTS 模型 id
  --port=<value>   [default: 8080] 服务监听端口(需与启动时一致)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  列出 audiocpp_server 共享参考音色库中的音色

EXAMPLES
  $ vp auc voices
```

_See code: [src/commands/auc/voices.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/auc/voices.ts)_
