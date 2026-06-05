---
inclusion: always
---

# Agent 经验总结

本文档记录在开发过程中遇到的问题和经验教训，避免重复犯错。

---

## 代码重构相关

### semanticRename 工具的局限性
**问题**: 使用 `semanticRename` 重命名导出的变量时，可能会遗漏项目根目录下的配置文件（如 drizzle.config.ts、vite.config.ts 等）中的引用。

**原因**: 
- 根目录的配置文件可能不在语言服务器的默认索引范围内
- 某些配置文件可能在重命名时未被正确加载到语义分析上下文中

**解决方案**:
1. 使用 `semanticRename` 后，必须通过 `grepSearch` 工具在整个项目中搜索旧的符号名称，确认是否有遗漏
2. 特别注意检查项目根目录下的配置文件（*.config.ts、*.config.js 等）
3. 使用 `getDiagnostics` 检查所有可能受影响的文件，包括配置文件

**示例命令**:
```
grepSearch: query="\\bconfig\\b", includePattern="**/*.ts"
```

**记录时间**: 2026-03-30

---

## 代码删除与清理相关

### 删除功能时需要全面检查相关配置
**问题**: 更改test-cli.ts代码中的某个命令或功能时，只更改了源代码文件中的实现，但遗漏了 `package.json` 中相关的 npm scripts。

**示例场景**:
删除 `test/cli/test-cli.ts` 中的 `all` 子命令时，不仅要删除代码中的命令定义，还要删除 `package.json` 中的 `"test:all": "tsx test/cli/test-cli.ts all"` script。

**记录时间**: 2026-05-02

---

## 文件移动相关

### smartRelocate 工具的局限性
**问题**: 使用 `smartRelocate` 工具移动文件后，工具虽然会自动更新导入该文件的其他文件的 import 路径，但**不会**自动更新被移动文件内部的相对路径引用（如 `resolve(__dirname, '../..')` 这样的路径计算）。

**示例场景**:
将 `test/testcmd/test-helper.ts` 移动到 `test/test-helper.ts` 时：
1. `smartRelocate` 会自动更新其他文件中 `import ... from 'xxx/test-helper.js'` 的路径
2. 但**不会**自动更新 `test-helper.ts` 内部的 `resolve(__dirname, '../..')` 为 `resolve(__dirname, '..')`

**原因**:
- `smartRelocate` 基于语言服务器的重构功能，只能识别和更新 import/export 语句
- 文件内部的字符串形式的相对路径（如传递给 `resolve()`、`join()` 等函数的路径参数）无法被语义分析识别为需要更新的引用

**解决方案**:
使用 `smartRelocate` 移动文件后，必须手动检查并更新被移动文件内部的所有相对路径引用：

1. **路径计算**：检查 `resolve()`、`join()`、`relative()` 等函数中的相对路径参数
2. **文件引用**：检查 `readFile()`、`writeFile()` 等文件操作中的相对路径
3. **配置路径**：检查配置对象中的路径字段

**检查清单**:
```typescript
// 需要检查的常见模式
resolve(__dirname, '../../xxx')     // 路径计算
join(process.cwd(), '../xxx')       // 路径拼接
'../config/xxx.json'                // 字符串形式的相对路径
{root: '../..'}                     // 配置对象中的路径
```

**最佳实践**:
1. 移动文件后立即运行类型检查命令（`npm run typecheck`）检查类型错误
2. 使用 `grep_search` 搜索被移动文件中的 `../` 模式，逐一检查是否需要更新
3. 如果文件包含路径计算逻辑，优先手动检查而不是依赖自动化工具

**记录时间**: 2026-05-11

