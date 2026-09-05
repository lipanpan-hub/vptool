`vp config`
===========

查看与编辑用户配置文件（支持内置 TUI 与外部编辑器）

* [`vp config edit`](#vp-config-edit)
* [`vp config show`](#vp-config-show)

## `vp config edit`

编辑用户配置文件, 默认启动内置 TUI 编辑器, 也可选择系统中的外部编辑器

```
USAGE
  $ vp config edit [-e]

FLAGS
  -e, --editor  交互式选择系统中可用的外部编辑器进行编辑

DESCRIPTION
  编辑用户配置文件, 默认启动内置 TUI 编辑器, 也可选择系统中的外部编辑器

ALIASES
  $ vp cf edit

EXAMPLES
  $ vp config edit

  $ vp config edit --editor
```

_See code: [src/commands/config/edit.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/config/edit.ts)_

## `vp config show`

列出所有的配置

```
USAGE
  $ vp config show

DESCRIPTION
  列出所有的配置

ALIASES
  $ vp cf ls
  $ vp cf show

EXAMPLES
  $ vp config show
```

_See code: [src/commands/config/show.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.3/src/commands/config/show.ts)_
