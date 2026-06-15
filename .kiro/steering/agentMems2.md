---
inclusion: always
---

# Agent 经验总结

本文档记录在开发过程中遇到的问题和经验教训，避免重复犯错。

## npm link 后 Permission denied

- 原因：`bin/run.js` / `bin/dev.js` 缺少执行权限，Windows 克隆到 Linux 时权限位会丢失。
- 修复：`chmod +x bin/run.js bin/dev.js`

## prompts autocomplete 类型必须提供 choices 属性

- `autocomplete` 类型必须同时提供 `choices` 属性，`suggest` 函数签名是 `(input, choices)`，不能只传 `input`。
- 正确写法：`suggest: async (input: string, choices: any[]) => { if (!input) return choices; ... }`

## 大文件处理：按输入特征选流式策略

- 行式格式（JSONL/CSV/日志）：`createReadStream` + `readline`，逐行处理立即释放。
- 非行式顺序消费：固定大小分块 + 滑动窗口处理跨块边界。
- 需要随机访问：`fs.open` + `read(fd, buf, offset, length)` 按需读取。
- 禁止"看似流式实则累积"：把每行 push 到数组再处理就退化回全量加载。
- 耗时操作必须有进度反馈（百分比/已处理量+速率），按时间间隔节流避免刷屏。
