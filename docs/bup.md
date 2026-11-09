`vp bup`
========

添加 biliup 监控主播(加入录制列表)

* [`vp bup add [URL]`](#vp-bup-add-url)
* [`vp bup cfset [DIR]`](#vp-bup-cfset-dir)
* [`vp bup jobs`](#vp-bup-jobs)
* [`vp bup pause [ID]`](#vp-bup-pause-id)
* [`vp bup resume [ID]`](#vp-bup-resume-id)
* [`vp bup rm [ID]`](#vp-bup-rm-id)
* [`vp bup run`](#vp-bup-run)
* [`vp bup server`](#vp-bup-server)
* [`vp bup sessions`](#vp-bup-sessions)
* [`vp bup stats`](#vp-bup-stats)
* [`vp bup status`](#vp-bup-status)
* [`vp bup stop`](#vp-bup-stop)
* [`vp bup streamers`](#vp-bup-streamers)
* [`vp bup up [FILES]`](#vp-bup-up-files)
* [`vp bup upload [FILES]`](#vp-bup-upload-files)
* [`vp bup videos`](#vp-bup-videos)

## `vp bup add [URL]`

添加 biliup 监控主播(加入录制列表)

```
USAGE
  $ vp bup add [URL] [--json] [--port <value>] [--bind <value>] [--remark <value>] [--prefix <value>]

ARGUMENTS
  [URL]  直播间地址(支持 B 站/抖音/斗鱼/虎牙等平台, 缺省时交互式输入)

FLAGS
  --bind=<value>    [default: 127.0.0.1] biliup 服务绑定地址
  --port=<value>    [default: 19159] biliup 服务端口
  --prefix=<value>  录制文件名前缀
  --remark=<value>  备注名称(列表中显示的名字, 缺省时交互式输入)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  添加 biliup 监控主播(加入录制列表)

EXAMPLES
  $ vp bup add https://live.bilibili.com/1234 --remark 某主播

  $ vp bup add https://live.bilibili.com/1234 --remark 某主播 --prefix 5535AI记忆

  $ vp bup add
```

_See code: [src/commands/bup/add.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/bup/add.ts)_

## `vp bup cfset [DIR]`

设置 biliupR 的目录路径到配置文件(写入当前配置档案的 biliupRDir 字段)

```
USAGE
  $ vp bup cfset [DIR] [--json]

ARGUMENTS
  [DIR]  biliupR 的目录路径(缺省时交互式输入)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  设置 biliupR 的目录路径到配置文件(写入当前配置档案的 biliupRDir 字段)

EXAMPLES
  $ vp bup cfset E:/tools/biliupR

  $ vp bup cfset
```

_See code: [src/commands/bup/cfset.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/bup/cfset.ts)_

## `vp bup jobs`

查看 biliup 的投稿发布队列状态

```
USAGE
  $ vp bup jobs [--json] [--port <value>] [--bind <value>]

FLAGS
  --bind=<value>  [default: 127.0.0.1] biliup 服务绑定地址
  --port=<value>  [default: 19159] biliup 服务端口

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  查看 biliup 的投稿发布队列状态

EXAMPLES
  $ vp bup jobs

  $ vp bup jobs --json
```

_See code: [src/commands/bup/jobs.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/bup/jobs.ts)_

## `vp bup pause [ID]`

暂停 biliup 对指定主播的录制(再次执行 vp bup resume 或本命令切换恢复)

```
USAGE
  $ vp bup pause [ID] [--json] [--port <value>] [--bind <value>]

ARGUMENTS
  [ID]  主播 id(缺省时交互式选择)

FLAGS
  --bind=<value>  [default: 127.0.0.1] biliup 服务绑定地址
  --port=<value>  [default: 19159] biliup 服务端口

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  暂停 biliup 对指定主播的录制(再次执行 vp bup resume 或本命令切换恢复)

EXAMPLES
  $ vp bup pause 3

  $ vp bup pause
```

_See code: [src/commands/bup/pause.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/bup/pause.ts)_

## `vp bup resume [ID]`

恢复 biliup 对指定主播的录制(服务端为切换语义, 暂停中则恢复)

```
USAGE
  $ vp bup resume [ID] [--json] [--port <value>] [--bind <value>]

ARGUMENTS
  [ID]  主播 id(缺省时交互式选择)

FLAGS
  --bind=<value>  [default: 127.0.0.1] biliup 服务绑定地址
  --port=<value>  [default: 19159] biliup 服务端口

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  恢复 biliup 对指定主播的录制(服务端为切换语义, 暂停中则恢复)

EXAMPLES
  $ vp bup resume 3

  $ vp bup resume
```

_See code: [src/commands/bup/resume.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/bup/resume.ts)_

## `vp bup rm [ID]`

从 biliup 删除监控主播(不影响已录制文件)

```
USAGE
  $ vp bup rm [ID] [--json] [--port <value>] [--bind <value>]

ARGUMENTS
  [ID]  主播 id(缺省时交互式选择)

FLAGS
  --bind=<value>  [default: 127.0.0.1] biliup 服务绑定地址
  --port=<value>  [default: 19159] biliup 服务端口

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  从 biliup 删除监控主播(不影响已录制文件)

EXAMPLES
  $ vp bup rm 3

  $ vp bup rm
```

_See code: [src/commands/bup/rm.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/bup/rm.ts)_

## `vp bup run`

后台启动 biliup web 服务并等待就绪(服务目录取配置档案的 biliupRDir 字段)

```
USAGE
  $ vp bup run [--json] [--port <value>] [--bind <value>]

FLAGS
  --bind=<value>  [default: 127.0.0.1] 服务绑定地址
  --port=<value>  [default: 19159] 服务监听端口

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  后台启动 biliup web 服务并等待就绪(服务目录取配置档案的 biliupRDir 字段)

ALIASES
  $ vp bup server
  $ vp bup run

EXAMPLES
  $ vp bup run

  $ vp bup run --port 19160
```

## `vp bup server`

后台启动 biliup web 服务并等待就绪(服务目录取配置档案的 biliupRDir 字段)

```
USAGE
  $ vp bup server [--json] [--port <value>] [--bind <value>]

FLAGS
  --bind=<value>  [default: 127.0.0.1] 服务绑定地址
  --port=<value>  [default: 19159] 服务监听端口

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  后台启动 biliup web 服务并等待就绪(服务目录取配置档案的 biliupRDir 字段)

ALIASES
  $ vp bup server
  $ vp bup run

EXAMPLES
  $ vp bup server

  $ vp bup server --port 19160
```

_See code: [src/commands/bup/server.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/bup/server.ts)_

## `vp bup sessions`

分页列出 biliup 的录制场次(回看记录)

```
USAGE
  $ vp bup sessions [--json] [--port <value>] [--bind <value>] [--page <value>] [--page-size <value>]

FLAGS
  --bind=<value>       [default: 127.0.0.1] biliup 服务绑定地址
  --page=<value>       [default: 1] 页码
  --page-size=<value>  [default: 20] 每页条数
  --port=<value>       [default: 19159] biliup 服务端口

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  分页列出 biliup 的录制场次(回看记录)

EXAMPLES
  $ vp bup sessions

  $ vp bup sessions --page 2 --page-size 50

  $ vp bup sessions --json
```

_See code: [src/commands/bup/sessions.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/bup/sessions.ts)_

## `vp bup stats`

查看 biliup 服务所在主机的资源快照: CPU/内存/磁盘/网速

```
USAGE
  $ vp bup stats [--json] [--port <value>] [--bind <value>]

FLAGS
  --bind=<value>  [default: 127.0.0.1] biliup 服务绑定地址
  --port=<value>  [default: 19159] biliup 服务端口

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  查看 biliup 服务所在主机的资源快照: CPU/内存/磁盘/网速

EXAMPLES
  $ vp bup stats

  $ vp bup stats --json
```

_See code: [src/commands/bup/stats.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/bup/stats.ts)_

## `vp bup status`

查看 biliup 服务概览: 版本、认证状态、房间数与关键录制配置

```
USAGE
  $ vp bup status [--json] [--port <value>] [--bind <value>]

FLAGS
  --bind=<value>  [default: 127.0.0.1] biliup 服务绑定地址
  --port=<value>  [default: 19159] biliup 服务端口

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  查看 biliup 服务概览: 版本、认证状态、房间数与关键录制配置

EXAMPLES
  $ vp bup status

  $ vp bup status --json

  $ vp bup status --port 19160
```

_See code: [src/commands/bup/status.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/bup/status.ts)_

## `vp bup stop`

停止 biliup web 服务(按监听端口定位进程并终止, 服务目录取配置档案的 biliupRDir 字段)

```
USAGE
  $ vp bup stop [--json] [--port <value>]

FLAGS
  --port=<value>  [default: 19159] 服务监听端口(需与启动时一致)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  停止 biliup web 服务(按监听端口定位进程并终止, 服务目录取配置档案的 biliupRDir 字段)

ALIASES
  $ vp bup stop

EXAMPLES
  $ vp bup stop

  $ vp bup stop --port 19160
```

_See code: [src/commands/bup/stop.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/bup/stop.ts)_

## `vp bup streamers`

列出 biliup 监控的全部主播及其录制/上传状态

```
USAGE
  $ vp bup streamers [--json] [--port <value>] [--bind <value>]

FLAGS
  --bind=<value>  [default: 127.0.0.1] biliup 服务绑定地址
  --port=<value>  [default: 19159] biliup 服务端口

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  列出 biliup 监控的全部主播及其录制/上传状态

EXAMPLES
  $ vp bup streamers

  $ vp bup streamers --json
```

_See code: [src/commands/bup/streamers.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/bup/streamers.ts)_

## `vp bup up [FILES]`

上传本地视频投稿到B站(调用配置目录下的 biliup.exe, 登录态取该目录 cookies.json); 未提供的参数会交互式提问收集

```
USAGE
  $ vp bup up [FILES...] [--json] [--title <value>] [--desc <value>] [--tag <value>] [--tid <value>]
    [--tidV2 <value>] [--copyright <value>] [--source <value>] [--cover <value>] [--line <value>] [--limit <value>]
    [--submit app|web|b-cut-android] [--dynamic <value>] [--dtime <value>] [-f <value>]

ARGUMENTS
  [FILES...]  视频文件路径(可传多个实现多P投稿; 全部省略则交互选择)

FLAGS
  -f, --fromYaml=<value>   从 yaml 预设导入视频路径与投稿参数(缺项继续交互), 如 --from-yaml bup-upload.yml
      --copyright=<value>  1-自制 2-转载(未传时交互选择, 交互默认 1)
      --cover=<value>      封面图片路径
      --desc=<value>       视频简介
      --dtime=<value>      延时发布时间(YYYY-MM-DD HH:mm 本地时区, 需晚于现在 4 小时; 缺省立即发布)
      --dynamic=<value>    空间动态内容
      --limit=<value>      单文件最大并发数(未传时交互输入, 交互默认 3)
      --line=<value>       上传线路(bldsa/cnbldsa/andsa/atdsa/bda2/cnbd/anbd/atbd/tx/cntx/antx/attx/txa/alia/estx/akbd;
                           缺省自动选择)
      --source=<value>     转载来源(copyright=2 时使用)
      --submit=<option>    提交接口
                           <options: app|web|b-cut-android>
      --tag=<value>        视频标签, 逗号分隔多个
      --tid=<value>        投稿分区 id(未传时交互选择, 交互默认 171)
      --tidV2=<value>      新版投稿分区 id tid_v2(未传时交互选择, 可选跳过; 不设置时不提交该字段)
      --title=<value>      视频标题(缺省由 biliup 按文件名处理)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  上传本地视频投稿到B站(调用配置目录下的 biliup.exe, 登录态取该目录 cookies.json); 未提供的参数会交互式提问收集

ALIASES
  $ vp bup up

EXAMPLES
  $ vp bup up video.mp4 --title 标题 --tag 标签1,标签2 --tid 171 --tid-v2 1020

  $ vp bup up part1.mp4 part2.mp4 --title 多P标题

  $ vp bup up --from-yaml bup-upload.yml

  $ vp bup up
```

## `vp bup upload [FILES]`

上传本地视频投稿到B站(调用配置目录下的 biliup.exe, 登录态取该目录 cookies.json); 未提供的参数会交互式提问收集

```
USAGE
  $ vp bup upload [FILES...] [--json] [--title <value>] [--desc <value>] [--tag <value>] [--tid <value>]
    [--tidV2 <value>] [--copyright <value>] [--source <value>] [--cover <value>] [--line <value>] [--limit <value>]
    [--submit app|web|b-cut-android] [--dynamic <value>] [--dtime <value>] [-f <value>]

ARGUMENTS
  [FILES...]  视频文件路径(可传多个实现多P投稿; 全部省略则交互选择)

FLAGS
  -f, --fromYaml=<value>   从 yaml 预设导入视频路径与投稿参数(缺项继续交互), 如 --from-yaml bup-upload.yml
      --copyright=<value>  1-自制 2-转载(未传时交互选择, 交互默认 1)
      --cover=<value>      封面图片路径
      --desc=<value>       视频简介
      --dtime=<value>      延时发布时间(YYYY-MM-DD HH:mm 本地时区, 需晚于现在 4 小时; 缺省立即发布)
      --dynamic=<value>    空间动态内容
      --limit=<value>      单文件最大并发数(未传时交互输入, 交互默认 3)
      --line=<value>       上传线路(bldsa/cnbldsa/andsa/atdsa/bda2/cnbd/anbd/atbd/tx/cntx/antx/attx/txa/alia/estx/akbd;
                           缺省自动选择)
      --source=<value>     转载来源(copyright=2 时使用)
      --submit=<option>    提交接口
                           <options: app|web|b-cut-android>
      --tag=<value>        视频标签, 逗号分隔多个
      --tid=<value>        投稿分区 id(未传时交互选择, 交互默认 171)
      --tidV2=<value>      新版投稿分区 id tid_v2(未传时交互选择, 可选跳过; 不设置时不提交该字段)
      --title=<value>      视频标题(缺省由 biliup 按文件名处理)

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  上传本地视频投稿到B站(调用配置目录下的 biliup.exe, 登录态取该目录 cookies.json); 未提供的参数会交互式提问收集

ALIASES
  $ vp bup up

EXAMPLES
  $ vp bup upload video.mp4 --title 标题 --tag 标签1,标签2 --tid 171 --tid-v2 1020

  $ vp bup upload part1.mp4 part2.mp4 --title 多P标题

  $ vp bup upload --from-yaml bup-upload.yml

  $ vp bup upload
```

_See code: [src/commands/bup/upload.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/bup/upload.ts)_

## `vp bup videos`

列出 biliup 录制产出的视频文件

```
USAGE
  $ vp bup videos [--json] [--port <value>] [--bind <value>]

FLAGS
  --bind=<value>  [default: 127.0.0.1] biliup 服务绑定地址
  --port=<value>  [default: 19159] biliup 服务端口

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  列出 biliup 录制产出的视频文件

EXAMPLES
  $ vp bup videos

  $ vp bup videos --json
```

_See code: [src/commands/bup/videos.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.6/src/commands/bup/videos.ts)_
