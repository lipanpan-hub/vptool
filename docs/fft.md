`vp fft`
========

基于 ffmpeg 的音视频处理（如从视频无损抽取音频）

* [`vp fft ea [VIDEO]`](#vp-fft-ea-video)
* [`vp fft extract-audio [VIDEO]`](#vp-fft-extract-audio-video)
* [`vp fft pb [MEDIA]`](#vp-fft-pb-media)
* [`vp fft probe [MEDIA]`](#vp-fft-probe-media)
* [`vp fft video-split-copy [VIDEO]`](#vp-fft-video-split-copy-video)
* [`vp fft vsc [VIDEO]`](#vp-fft-vsc-video)

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

_See code: [src/commands/fft/extract-audio.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.0/src/commands/fft/extract-audio.ts)_

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

_See code: [src/commands/fft/probe.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.0/src/commands/fft/probe.ts)_

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

_See code: [src/commands/fft/video-split-copy.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.0/src/commands/fft/video-split-copy.ts)_

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
