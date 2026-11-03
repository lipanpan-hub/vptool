`vp mpv`
========

交互式选择视频/vtt 字幕/音频后调用 mpv 播放: 字幕作为外挂字幕, 音频作为外部音轨替换视频原声

* [`vp mpv`](#vp-mpv)

## `vp mpv`

交互式选择视频/vtt 字幕/音频后调用 mpv 播放: 字幕作为外挂字幕, 音频作为外部音轨替换视频原声

```
USAGE
  $ vp mpv [--json] [--window-size <value>]

FLAGS
  --window-size=<value>  mpv 窗口适配大小, 格式 WxH(视频按宽高比缩放, 不超过该尺寸), 默认 1280x720

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  交互式选择视频/vtt 字幕/音频后调用 mpv 播放: 字幕作为外挂字幕, 音频作为外部音轨替换视频原声

EXAMPLES
  $ vp mpv

  $ vp mpv --window-size 1920x1080
```

_See code: [src/commands/mpv/index.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/mpv/index.ts)_
