`vp fft`
========

基于 ffmpeg 的音视频处理（如从视频无损抽取音频）

* [`vp fft aa [VIDEO] [AUDIO]`](#vp-fft-aa-video-audio)
* [`vp fft add-audio [VIDEO] [AUDIO]`](#vp-fft-add-audio-video-audio)
* [`vp fft bs [VIDEO] [SUBTITLE]`](#vp-fft-bs-video-subtitle)
* [`vp fft burn-subtitle [VIDEO] [SUBTITLE]`](#vp-fft-burn-subtitle-video-subtitle)
* [`vp fft change-speed [AUDIO] [SPEED]`](#vp-fft-change-speed-audio-speed)
* [`vp fft cs [AUDIO] [SPEED]`](#vp-fft-cs-audio-speed)
* [`vp fft ea [VIDEO]`](#vp-fft-ea-video)
* [`vp fft extract-audio [VIDEO]`](#vp-fft-extract-audio-video)
* [`vp fft pb [MEDIA]`](#vp-fft-pb-media)
* [`vp fft probe [MEDIA]`](#vp-fft-probe-media)
* [`vp fft ra [AUDIO]`](#vp-fft-ra-audio)
* [`vp fft reencode-audio [AUDIO]`](#vp-fft-reencode-audio-audio)
* [`vp fft trim-silence [AUDIO]`](#vp-fft-trim-silence-audio)
* [`vp fft ts [AUDIO]`](#vp-fft-ts-audio)
* [`vp fft video-split-copy [VIDEO]`](#vp-fft-video-split-copy-video)
* [`vp fft vsc [VIDEO]`](#vp-fft-vsc-video)

## `vp fft aa [VIDEO] [AUDIO]`

把新音轨合并进视频: 原声轨保留, copy 不重编码, 新音轨置为默认并排在首位; 源视频备份为 .old, 结果占用原文件名; 源名带 .old. 时视为备份文件, 结果去除 .old 且不再备份; 可选把 vtt 字幕烧写进结果

```
USAGE
  $ vp fft aa [VIDEO] [AUDIO] [-d] [-s <value>]

ARGUMENTS
  [VIDEO]  源视频文件(省略则扫描当前目录交互选择)
  [AUDIO]  要加入的音轨文件(省略则扫描当前目录交互选择)

FLAGS
  -d, --delete-audio      合并成功后删除源音频文件(默认保留)
  -s, --subtitle=<value>  要烧写进合并结果的 vtt 字幕文件(省略则交互询问是否烧写)

DESCRIPTION
  把新音轨合并进视频: 原声轨保留, copy 不重编码, 新音轨置为默认并排在首位; 源视频备份为 .old, 结果占用原文件名; 源名带
  .old. 时视为备份文件, 结果去除 .old 且不再备份; 可选把 vtt 字幕烧写进结果

ALIASES
  $ vp fft aa

EXAMPLES
  $ vp fft aa input.mp4 bgm.mp3

  $ vp fft aa input.mp4 bgm.mp3 --subtitle sub.vtt

  $ vp fft aa input.mp4 bgm.mp3 --delete-audio

  $ vp fft aa
```

## `vp fft add-audio [VIDEO] [AUDIO]`

把新音轨合并进视频: 原声轨保留, copy 不重编码, 新音轨置为默认并排在首位; 源视频备份为 .old, 结果占用原文件名; 源名带 .old. 时视为备份文件, 结果去除 .old 且不再备份; 可选把 vtt 字幕烧写进结果

```
USAGE
  $ vp fft add-audio [VIDEO] [AUDIO] [-d] [-s <value>]

ARGUMENTS
  [VIDEO]  源视频文件(省略则扫描当前目录交互选择)
  [AUDIO]  要加入的音轨文件(省略则扫描当前目录交互选择)

FLAGS
  -d, --delete-audio      合并成功后删除源音频文件(默认保留)
  -s, --subtitle=<value>  要烧写进合并结果的 vtt 字幕文件(省略则交互询问是否烧写)

DESCRIPTION
  把新音轨合并进视频: 原声轨保留, copy 不重编码, 新音轨置为默认并排在首位; 源视频备份为 .old, 结果占用原文件名; 源名带
  .old. 时视为备份文件, 结果去除 .old 且不再备份; 可选把 vtt 字幕烧写进结果

ALIASES
  $ vp fft aa

EXAMPLES
  $ vp fft add-audio input.mp4 bgm.mp3

  $ vp fft add-audio input.mp4 bgm.mp3 --subtitle sub.vtt

  $ vp fft add-audio input.mp4 bgm.mp3 --delete-audio

  $ vp fft add-audio
```

_See code: [src/commands/fft/add-audio.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/fft/add-audio.ts)_

## `vp fft bs [VIDEO] [SUBTITLE]`

把 vtt 字幕烧写(硬字幕)进视频画面: webm 走 AV1 编码, 其余容器优先用 NVENC 硬件编码

```
USAGE
  $ vp fft bs [VIDEO] [SUBTITLE] [--alignment <value>] [--crf <value>] [--font-color <value>] [--font-name
    <value>] [--font-size <value>] [-f] [--margin-v <value>] [--outline-color <value>] [-o <value>]

ARGUMENTS
  [VIDEO]     源视频文件(省略则扫描当前目录交互选择)
  [SUBTITLE]  要烧写的 vtt 字幕文件(省略则扫描当前目录交互选择)

FLAGS
  -f, --force                  输出文件已存在时直接覆盖, 不再询问
  -o, --output=<value>         输出文件路径(默认在源文件旁生成带 .burned 后缀的新文件)
      --alignment=<value>      字幕位置(ASS 布局 1-9: 1/2/3 底部, 4/5/6 中部, 7/8/9 顶部, 默认 2)
      --crf=<value>            视频质量 CRF(0-51, 越小越清晰; webm/AV1 默认 35, 其它容器默认 23)
      --font-color=<value>     字幕填充色, 十六进制 #RRGGBB
      --font-name=<value>      字体名(如 "微软雅黑"), 缺省用 ffmpeg 默认字体
      --font-size=<value>      字号(默认 24)
      --margin-v=<value>       字幕距画面边缘的垂直像素
      --outline-color=<value>  字幕描边颜色, 十六进制 #RRGGBB

DESCRIPTION
  把 vtt 字幕烧写(硬字幕)进视频画面: webm 走 AV1 编码, 其余容器优先用 NVENC 硬件编码

ALIASES
  $ vp fft bs

EXAMPLES
  $ vp fft bs input.mp4 sub.vtt

  $ vp fft bs input.mp4 sub.vtt --font-size 28 --font-color "#FFFFFF"

  $ vp fft bs input.mp4 sub.vtt --alignment 2 --margin-v 40 --crf 20

  $ vp fft bs
```

## `vp fft burn-subtitle [VIDEO] [SUBTITLE]`

把 vtt 字幕烧写(硬字幕)进视频画面: webm 走 AV1 编码, 其余容器优先用 NVENC 硬件编码

```
USAGE
  $ vp fft burn-subtitle [VIDEO] [SUBTITLE] [--alignment <value>] [--crf <value>] [--font-color <value>] [--font-name
    <value>] [--font-size <value>] [-f] [--margin-v <value>] [--outline-color <value>] [-o <value>]

ARGUMENTS
  [VIDEO]     源视频文件(省略则扫描当前目录交互选择)
  [SUBTITLE]  要烧写的 vtt 字幕文件(省略则扫描当前目录交互选择)

FLAGS
  -f, --force                  输出文件已存在时直接覆盖, 不再询问
  -o, --output=<value>         输出文件路径(默认在源文件旁生成带 .burned 后缀的新文件)
      --alignment=<value>      字幕位置(ASS 布局 1-9: 1/2/3 底部, 4/5/6 中部, 7/8/9 顶部, 默认 2)
      --crf=<value>            视频质量 CRF(0-51, 越小越清晰; webm/AV1 默认 35, 其它容器默认 23)
      --font-color=<value>     字幕填充色, 十六进制 #RRGGBB
      --font-name=<value>      字体名(如 "微软雅黑"), 缺省用 ffmpeg 默认字体
      --font-size=<value>      字号(默认 24)
      --margin-v=<value>       字幕距画面边缘的垂直像素
      --outline-color=<value>  字幕描边颜色, 十六进制 #RRGGBB

DESCRIPTION
  把 vtt 字幕烧写(硬字幕)进视频画面: webm 走 AV1 编码, 其余容器优先用 NVENC 硬件编码

ALIASES
  $ vp fft bs

EXAMPLES
  $ vp fft burn-subtitle input.mp4 sub.vtt

  $ vp fft burn-subtitle input.mp4 sub.vtt --font-size 28 --font-color "#FFFFFF"

  $ vp fft burn-subtitle input.mp4 sub.vtt --alignment 2 --margin-v 40 --crf 20

  $ vp fft burn-subtitle
```

_See code: [src/commands/fft/burn-subtitle.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/fft/burn-subtitle.ts)_

## `vp fft change-speed [AUDIO] [SPEED]`

借助 ffmpeg atempo 对音频调速(变速不变调, 保持原音色)

```
USAGE
  $ vp fft change-speed [AUDIO] [SPEED] [-f] [-o <value>]

ARGUMENTS
  [AUDIO]  源音频文件(省略则扫描当前目录交互选择)
  [SPEED]  速度倍率, 大于 1 加速、小于 1 减速(省略则交互输入)

FLAGS
  -f, --force           输出文件已存在时直接覆盖, 不再询问
  -o, --output=<value>  输出文件路径(默认在源文件旁生成带倍率后缀的新文件)

DESCRIPTION
  借助 ffmpeg atempo 对音频调速(变速不变调, 保持原音色)

ALIASES
  $ vp fft cs

EXAMPLES
  $ vp fft change-speed input.mp3 1.5

  $ vp fft change-speed input.mp3 0.8

  $ vp fft change-speed input.mp3 1.5 -o fast.mp3

  $ vp fft change-speed input.mp3 1.5 -f

  $ vp fft change-speed
```

_See code: [src/commands/fft/change-speed.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/fft/change-speed.ts)_

## `vp fft cs [AUDIO] [SPEED]`

借助 ffmpeg atempo 对音频调速(变速不变调, 保持原音色)

```
USAGE
  $ vp fft cs [AUDIO] [SPEED] [-f] [-o <value>]

ARGUMENTS
  [AUDIO]  源音频文件(省略则扫描当前目录交互选择)
  [SPEED]  速度倍率, 大于 1 加速、小于 1 减速(省略则交互输入)

FLAGS
  -f, --force           输出文件已存在时直接覆盖, 不再询问
  -o, --output=<value>  输出文件路径(默认在源文件旁生成带倍率后缀的新文件)

DESCRIPTION
  借助 ffmpeg atempo 对音频调速(变速不变调, 保持原音色)

ALIASES
  $ vp fft cs

EXAMPLES
  $ vp fft cs input.mp3 1.5

  $ vp fft cs input.mp3 0.8

  $ vp fft cs input.mp3 1.5 -o fast.mp3

  $ vp fft cs input.mp3 1.5 -f

  $ vp fft cs
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

_See code: [src/commands/fft/extract-audio.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/fft/extract-audio.ts)_

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

_See code: [src/commands/fft/probe.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/fft/probe.ts)_

## `vp fft ra [AUDIO]`

把音频重新编码为目标格式(交互式选择源文件与目标格式)

```
USAGE
  $ vp fft ra [AUDIO]

ARGUMENTS
  [AUDIO]  源音频文件(省略则扫描当前目录交互选择)

DESCRIPTION
  把音频重新编码为目标格式(交互式选择源文件与目标格式)

ALIASES
  $ vp fft ra

EXAMPLES
  $ vp fft ra input.wav

  $ vp fft ra
```

## `vp fft reencode-audio [AUDIO]`

把音频重新编码为目标格式(交互式选择源文件与目标格式)

```
USAGE
  $ vp fft reencode-audio [AUDIO]

ARGUMENTS
  [AUDIO]  源音频文件(省略则扫描当前目录交互选择)

DESCRIPTION
  把音频重新编码为目标格式(交互式选择源文件与目标格式)

ALIASES
  $ vp fft ra

EXAMPLES
  $ vp fft reencode-audio input.wav

  $ vp fft reencode-audio
```

_See code: [src/commands/fft/reencode-audio.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/fft/reencode-audio.ts)_

## `vp fft trim-silence [AUDIO]`

切除音频中的静音片段, 只保留有人说话的片段

```
USAGE
  $ vp fft trim-silence [AUDIO] [--min-silence <value>] [--padding <value>] [--threshold <value>]

ARGUMENTS
  [AUDIO]  源音频文件(省略则扫描当前目录交互选择)

FLAGS
  --min-silence=<value>  [default: 0.5] 最短静音时长(秒), 只有达到该时长的静音才会被切除
  --padding=<value>      [default: 0.1] 语音片段首尾保留的余量(秒), 避免削掉字头字尾
  --threshold=<value>    [default: -30dB] 静音判定阈值, 响度低于该值视为静音(如 -30dB)

DESCRIPTION
  切除音频中的静音片段, 只保留有人说话的片段

ALIASES
  $ vp fft ts

EXAMPLES
  $ vp fft trim-silence input.mp3

  $ vp fft trim-silence input.mp3 --threshold=-40dB --min-silence=0.8

  $ vp fft trim-silence
```

_See code: [src/commands/fft/trim-silence.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/fft/trim-silence.ts)_

## `vp fft ts [AUDIO]`

切除音频中的静音片段, 只保留有人说话的片段

```
USAGE
  $ vp fft ts [AUDIO] [--min-silence <value>] [--padding <value>] [--threshold <value>]

ARGUMENTS
  [AUDIO]  源音频文件(省略则扫描当前目录交互选择)

FLAGS
  --min-silence=<value>  [default: 0.5] 最短静音时长(秒), 只有达到该时长的静音才会被切除
  --padding=<value>      [default: 0.1] 语音片段首尾保留的余量(秒), 避免削掉字头字尾
  --threshold=<value>    [default: -30dB] 静音判定阈值, 响度低于该值视为静音(如 -30dB)

DESCRIPTION
  切除音频中的静音片段, 只保留有人说话的片段

ALIASES
  $ vp fft ts

EXAMPLES
  $ vp fft ts input.mp3

  $ vp fft ts input.mp3 --threshold=-40dB --min-silence=0.8

  $ vp fft ts
```

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

_See code: [src/commands/fft/video-split-copy.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/fft/video-split-copy.ts)_

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
