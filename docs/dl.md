`vp dl`
=======

下载视频并管理本地依赖环境（基于 yt-dlp 与 ffmpeg）

* [`vp dl URL`](#vp-dl-url)
* [`vp dl cd [X]`](#vp-dl-cd-x)
* [`vp dl check`](#vp-dl-check)
* [`vp dl list`](#vp-dl-list)
* [`vp dl open`](#vp-dl-open)
* [`vp dl updatebin`](#vp-dl-updatebin)
* [`vp dl video URL`](#vp-dl-video-url)
* [`vp dl vmeta URL`](#vp-dl-vmeta-url)

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

_See code: [src/commands/dl/index.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/dl/index.ts)_

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

_See code: [src/commands/dl/cd.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/dl/cd.ts)_

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

_See code: [src/commands/dl/check.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/dl/check.ts)_

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

_See code: [src/commands/dl/list.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/dl/list.ts)_

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

_See code: [src/commands/dl/open.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/dl/open.ts)_

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

_See code: [src/commands/dl/updatebin.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/dl/updatebin.ts)_

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

_See code: [src/commands/dl/video.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/dl/video.ts)_

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

_See code: [src/commands/dl/vmeta.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/dl/vmeta.ts)_
