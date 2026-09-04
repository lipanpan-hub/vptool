`vp vtt`
========

处理 VTT 字幕（单行压缩、按分段重新打时间戳等）

* [`vp vtt restamp [VTT] [TEXT]`](#vp-vtt-restamp-vtt-text)
* [`vp vtt zip [FILE]`](#vp-vtt-zip-file)

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

_See code: [src/commands/vtt/restamp.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.0/src/commands/vtt/restamp.ts)_

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

_See code: [src/commands/vtt/zip.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.0/src/commands/vtt/zip.ts)_
