@lppx/vptool
=================

a cli tool for video process


[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@lppx/vptool.svg)](https://npmjs.org/package/@lppx/vptool)
[![Downloads/week](https://img.shields.io/npm/dw/@lppx/vptool.svg)](https://npmjs.org/package/@lppx/vptool)


<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @lppx/vptool
$ vp COMMAND
running command...
$ vp (--version)
@lppx/vptool/0.0.0 win32-x64 node-v24.14.1
$ vp --help [COMMAND]
USAGE
  $ vp COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`vp hello PERSON`](#vp-hello-person)
* [`vp hello world`](#vp-hello-world)
* [`vp help [COMMAND]`](#vp-help-command)
* [`vp plugins`](#vp-plugins)
* [`vp plugins add PLUGIN`](#vp-plugins-add-plugin)
* [`vp plugins:inspect PLUGIN...`](#vp-pluginsinspect-plugin)
* [`vp plugins install PLUGIN`](#vp-plugins-install-plugin)
* [`vp plugins link PATH`](#vp-plugins-link-path)
* [`vp plugins remove [PLUGIN]`](#vp-plugins-remove-plugin)
* [`vp plugins reset`](#vp-plugins-reset)
* [`vp plugins uninstall [PLUGIN]`](#vp-plugins-uninstall-plugin)
* [`vp plugins unlink [PLUGIN]`](#vp-plugins-unlink-plugin)
* [`vp plugins update`](#vp-plugins-update)

## `vp hello PERSON`

Say hello

```
USAGE
  $ vp hello PERSON -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ vp hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [src/commands/hello/index.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.0/src/commands/hello/index.ts)_

## `vp hello world`

Say hello world

```
USAGE
  $ vp hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ vp hello world
  hello world! (./src/commands/hello/world.ts)
```

_See code: [src/commands/hello/world.ts](https://github.com/lipanpan-hub/vptool/blob/v0.0.0/src/commands/hello/world.ts)_

## `vp help [COMMAND]`

Display help for vp.

```
USAGE
  $ vp help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for vp.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/6.2.50/src/commands/help.ts)_

## `vp plugins`

List installed plugins.

```
USAGE
  $ vp plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ vp plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.4.72/src/commands/plugins/index.ts)_

## `vp plugins add PLUGIN`

Installs a plugin into vp.

```
USAGE
  $ vp plugins add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into vp.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the VP_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the VP_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ vp plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ vp plugins add myplugin

  Install a plugin from a github url.

    $ vp plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ vp plugins add someuser/someplugin
```

## `vp plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ vp plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ vp plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.4.72/src/commands/plugins/inspect.ts)_

## `vp plugins install PLUGIN`

Installs a plugin into vp.

```
USAGE
  $ vp plugins install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into vp.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the VP_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the VP_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ vp plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ vp plugins install myplugin

  Install a plugin from a github url.

    $ vp plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ vp plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.4.72/src/commands/plugins/install.ts)_

## `vp plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ vp plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ vp plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.4.72/src/commands/plugins/link.ts)_

## `vp plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ vp plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ vp plugins unlink
  $ vp plugins remove

EXAMPLES
  $ vp plugins remove myplugin
```

## `vp plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ vp plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.4.72/src/commands/plugins/reset.ts)_

## `vp plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ vp plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ vp plugins unlink
  $ vp plugins remove

EXAMPLES
  $ vp plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.4.72/src/commands/plugins/uninstall.ts)_

## `vp plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ vp plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ vp plugins unlink
  $ vp plugins remove

EXAMPLES
  $ vp plugins unlink myplugin
```

## `vp plugins update`

Update installed plugins.

```
USAGE
  $ vp plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.4.72/src/commands/plugins/update.ts)_
<!-- commandsstop -->
