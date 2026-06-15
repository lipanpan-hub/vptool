---
inclusion: always
---

# Agent 经验总结

本文档记录在开发过程中遇到的问题和经验教训，避免重复犯错。

## semanticRename 之后必须手动验证覆盖范围

- `semanticRename` 可能遗漏根目录下的配置文件（如 `*.config.ts`），因为它们不一定在语言服务器的索引范围内。
- 重命名后必须用 `grep_search` 搜索旧符号名，确认无遗漏，再用 `getDiagnostics` 检查受影响文件。

## 删除功能时要同步清理 package.json scripts

- 删除某个命令或功能时，除了删源码，还要检查 `package.json` 中有无对应的 npm scripts 需要一并删除。

## smartRelocate 不更新文件内部的相对路径

- `smartRelocate` 只更新其他文件的 import 路径，**不会**更新被移动文件内部的 `resolve()`、`join()` 等路径计算。
- 移动文件后必须手动检查文件内部所有 `../` 相对路径，必要时运行 `npm run typecheck` 验证。
