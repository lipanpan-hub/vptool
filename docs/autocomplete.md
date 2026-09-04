`vp autocomplete`
=================

Display autocomplete installation instructions.

* [`vp autocomplete [SHELL]`](#vp-autocomplete-shell)

## `vp autocomplete [SHELL]`

Display autocomplete installation instructions.

```
USAGE
  $ vp autocomplete [SHELL] [-r]

ARGUMENTS
  [SHELL]  (zsh|bash|powershell) Shell type

FLAGS
  -r, --refresh-cache  Refresh cache (ignores displaying instructions)

DESCRIPTION
  Display autocomplete installation instructions.

EXAMPLES
  $ vp autocomplete

  $ vp autocomplete bash

  $ vp autocomplete zsh

  $ vp autocomplete powershell

  $ vp autocomplete --refresh-cache
```

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v3.2.50/src/commands/autocomplete/index.ts)_
