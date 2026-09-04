`vp dyd`
========

解析并下载抖音视频（可自动抽取音频）

* [`vp dyd fetch-one-video INPUT`](#vp-dyd-fetch-one-video-input)
* [`vp dyd fov INPUT`](#vp-dyd-fov-input)

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

_See code: [src/commands/dyd/fetch-one-video.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.0/src/commands/dyd/fetch-one-video.ts)_

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
