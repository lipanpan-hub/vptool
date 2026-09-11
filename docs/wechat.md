`vp wechat`
===========

下载微信公众号文章为本地文档

* [`vp wechat mp dl URL`](#vp-wechat-mp-dl-url)
* [`vp wechat mp opendir`](#vp-wechat-mp-opendir)

## `vp wechat mp dl URL`

下载微信公众号文章为本地 txt 文档(通过 TikHub 接口)

```
USAGE
  $ vp wechat mp dl URL [-o <value>] [-p tikhub-h5|tikhub]

ARGUMENTS
  URL  微信公众号文章链接

FLAGS
  -o, --output=<value>     输出目录(默认为配置文件中的 documentsPath)
  -p, --provider=<option>  指定解析接口(不指定则在存在多个接口时进入交互式选择菜单)
                           <options: tikhub-h5|tikhub>

DESCRIPTION
  下载微信公众号文章为本地 txt 文档(通过 TikHub 接口)

ALIASES
  $ vp wx mp dl
  $ vp mp dl

EXAMPLES
  $ vp wechat mp dl https://mp.weixin.qq.com/s/xxxxxxx

  $ vp wechat mp dl https://mp.weixin.qq.com/s/xxxxxxx --provider tikhub-h5
```

_See code: [src/commands/wechat/mp/dl.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/wechat/mp/dl.ts)_

## `vp wechat mp opendir`

打开配置文件中 documentsPath 下的 1111微信公众号 目录

```
USAGE
  $ vp wechat mp opendir

DESCRIPTION
  打开配置文件中 documentsPath 下的 1111微信公众号 目录

ALIASES
  $ vp wx mp opendir
  $ vp mp opendir
  $ vp mp open

EXAMPLES
  $ vp wechat mp opendir
```

_See code: [src/commands/wechat/mp/opendir.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/wechat/mp/opendir.ts)_
