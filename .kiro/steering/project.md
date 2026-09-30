# 项目经验

- `skills/vp-skill/SKILL.md` 是给其他 Agent 调用 `vp` 的说明，新增/修改命令的参数、默认值、产物路径或交互行为时要同步更新它。
- `vp dl`、`vp douyin fetch-one-video` 必定调用 `selectPrefix` 弹出交互菜单，`vp fft video-split-copy` 的起止时间只能交互输入，目前 Agent 无法非交互执行这几个命令。
- `vp vtt restamp` 默认删除输入的 txt，需要 `-k` 才保留。
- `vp dl sub` 默认输出到当前目录，传 `-l` 后没有交互，可以在 testmp 目录下直接实测（dQw4w9WgXcQ 有人工 en 和 157 条自动字幕，`zh-Hans` 只存在于自动字幕里）。
