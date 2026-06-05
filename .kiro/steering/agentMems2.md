---
inclusion: always
---

# Agent 经验总结

本文档记录在开发过程中遇到的问题和经验教训，避免重复犯错。

---

## 2026-05-13: npm link 后命令执行权限问题

### 问题描述
执行 `npm link` 成功后，运行 `xt` 命令时出现权限错误：
```
bash: /home/vagrant/.nvm/versions/node/v22.16.0/bin/xt: Permission denied
```

### 根本原因
`bin/run.js` 和 `bin/dev.js` 文件缺少执行权限（`+x`）。`npm link` 创建的符号链接指向这些文件，但由于文件本身没有执行权限，导致无法运行。

### 解决方案
```bash
chmod +x bin/run.js bin/dev.js
```

### 问题分析
1. **Git 不保存文件权限**：Git 默认只跟踪文件的可执行位（executable bit），但在某些情况下（如 Windows 系统克隆到 Linux）可能会丢失
2. **npm link 依赖文件权限**：`npm link` 创建的符号链接需要目标文件具有执行权限才能正常工作
3. **OCLIF 项目的特殊要求**：bin 目录中的 `.js` 文件是 CLI 工具的入口点，必须具有执行权限

### 预防措施
1. **在 package.json 中添加 postinstall 脚本**（可选）：
   ```json
   "scripts": {
     "postinstall": "chmod +x bin/run.js bin/dev.js"
   }
   ```

2. **在 .gitattributes 中明确指定行尾符**（已添加）：
   ```
   bin/*.js eol=lf
   ```

3. **在项目文档中说明**：提醒开发者在克隆项目后需要确保 bin 目录中的文件具有执行权限

### 经验教训
1. **CLI 工具开发需要注意文件权限**：开发命令行工具时，入口文件的执行权限是必需的
2. **跨平台开发的权限问题**：在 Windows 和 Linux/macOS 之间切换开发时，要特别注意文件权限的保持
3. **npm link 的前置条件**：使用 `npm link` 前应确保所有入口文件都有正确的权限设置
4. **自动化权限设置**：可以通过 npm scripts 或 Git hooks 自动设置必要的文件权限

---

## 2026-05-13: prompts 库 autocomplete 类型使用错误

### 问题描述
在 `src/commands/tkn/list.ts` 中使用 `prompts` 库的 `autocomplete` 类型时，配置对象不完整导致功能无法正常工作。

### 错误代码
```typescript
const response = await prompts({
  message: '请选择要使用的模型:',
  name: 'model',
  suggest: async (input: string) => {
    if (!input) return modelChoices
    const results = fuse.search(input)
    return results.map((result) => result.item)
  },
  type: 'autocomplete',
})
```

### 问题分析
1. **缺少 `choices` 属性**：`autocomplete` 类型必须提供 `choices` 属性作为初始选项列表
2. **`suggest` 函数签名不正确**：该函数应接收两个参数 `(input, choices)`，而不是只接收 `input`
3. **闭包依赖不规范**：在 `suggest` 中直接引用外部的 `modelChoices` 而不是使用传入的 `choices` 参数

### 正确实现
```typescript
const response = await prompts({
  choices: modelChoices,  // 必须提供 choices 属性
  message: '请选择要使用的模型:',
  name: 'model',
  suggest: async (input: string, choices: any[]) => {  // 接收两个参数
    if (!input) return choices  // 使用传入的 choices 参数
    const results = fuse.search(input)
    return results.map((result) => result.item)
  },
  type: 'autocomplete',
})
```

### 经验教训
1. **使用第三方库前先查阅文档**：在使用不熟悉的 API 时，应该先查看官方文档或类型定义，了解正确的使用方式
2. **注意函数签名的完整性**：回调函数的参数不仅仅是为了接收数据，有时也是库设计的一部分（如这里的 `choices` 参数）
3. **优先使用参数而非闭包**：当函数参数已经提供了所需数据时，应优先使用参数而不是依赖闭包中的变量
4. **类型检查很重要**：TypeScript 的类型系统能帮助发现这类问题，应该重视编译时的类型错误

### 预防措施
- 在编写涉及第三方库的交互式功能时，先编写简单的测试用例验证 API 使用是否正确
- 对于有多个配置项的复杂 API，逐项检查必需属性是否都已提供
- 善用 IDE 的类型提示和自动补全功能，避免遗漏必需的配置项

---

## 大文件处理通用方法论

### 问题模式
任何"一次性把整个文件读进内存再处理"的代码，遇到超大输入都会出现内存暴涨、进程被 OOM kill 或长时间无响应等症状。常见反模式：`readFileSync` + 全量字符串处理、`JSON.parse(整文件)`、把整个 Buffer 加载后再做编码/哈希/正则等单遍可完成的操作。

### 处理策略选型
按输入特征选择，不要一刀切：
- **行式格式**（JSONL、CSV、日志、纯文本按行处理）：用 `createReadStream` + `readline.createInterface` 逐行处理，处理完一行立即释放
- **非行式但可顺序消费**（二进制、XML、长文本）：按固定大小分块（chunk）处理，配合滑动窗口处理跨块边界的情况
- **需要随机访问**：用 `fs.open` + `read(fd, buffer, offset, length)` 按需读取片段，或考虑使用专门的索引/格式（Parquet、SQLite 等）
- **必须整体加载**（如某些格式的解析器无流式 API）：明确告知用户上限，并尽早 fail-fast

### 阈值切换设计
不要让简单场景背上复杂逻辑的成本：
- 设置一个文件大小阈值，**阈值以下走简单同步路径，阈值以上走流式/分块路径**
- 阈值数值不是常量，而是经验值，应留出配置接口或常量便于按部署环境调整
- 切换对调用方透明：相同输入相同输出，只是内部实现不同

### 用户反馈
任何耗时可能超过几秒的操作必须有进度反馈：
- 已知总量时显示百分比 + ETA
- 未知总量时显示已处理量 + 速率
- 反馈频率要适中，避免刷屏（可按时间间隔或处理量节流）

### 内存管理要点
- 流式处理的关键是**及时释放**：每个单元（行、块）处理完后不再持有引用
- 警惕"看似流式实则累积"：把每行结果 push 到数组里再一起处理就退化回了全量加载
- 大对象处理后显式置 `null` 帮助 GC（在严苛场景下有效）
- 监控实际内存占用而不是相信代码"看起来"流式

### 经验教训
1. **性能问题要量化定位**：先用真实规模的输入复现问题，记录内存峰值和耗时，再决定优化方向。凭直觉猜测往往优化错地方
2. **渐进式优化优于一刀切**：小输入的简单路径不要为了"统一"而复杂化，会牺牲常见场景的性能和可读性
3. **测试必须用真实规模数据**：单元测试常用的小样本无法暴露内存和性能问题，要单独写大数据规模的性能测试
4. **流式 API 是 Node.js 生态的标准能力**：`stream`、`readline`、`pipeline` 是处理大数据的基础设施，遇到大文件优先考虑这些而不是自己造轮子
5. **OOM 不是"内存不够"，而是"算法选错了"**：硬件升级只是把问题往后推，正确做法是改用不需要全量加载的算法

---

