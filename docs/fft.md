`vp fft`
========

基于 ffmpeg 的音视频处理（如从视频无损抽取音频）

* [`vp fft ea [VIDEO]`](#vp-fft-ea-video)
* [`vp fft extract-audio [VIDEO]`](#vp-fft-extract-audio-video)

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
