import {readdirSync} from 'node:fs'
import {join, relative, sep} from 'node:path'

import Fuse from 'fuse.js'
import {pinyin} from 'pinyin-pro'

// 目录节点: 根节点的 parentPath 为 null
export interface DirNode {
  depth: number
  fullPath: string
  name: string
  parentPath: string | null
  relPath: string
}

// 搜索索引条目: 目录名的全拼/首字母在扫描时预计算, 供 Fuse 模糊匹配
interface SearchEntry {
  name: string
  node: DirNode
  py: string
  pyFirst: string
  relPath: string
}

/**
 * 目录树索引: 一次扫描后提供父子关系查询与全树拼音模糊搜索。
 * 只收集目录(不 stat 文件), 供双栏目录浏览器与参数直达使用。
 */
export class DirectoryIndex {
  private readonly childrenByParent = new Map<string, DirNode[]>()
  private readonly fuse: Fuse<SearchEntry>
  private readonly nodeByPath = new Map<string, DirNode>()
  private readonly nodes: DirNode[] = []
  private readonly searchEntries: SearchEntry[] = []

  constructor(private readonly rootPath: string) {
    this.scan()
    this.fuse = new Fuse(this.searchEntries, {
      // 名称权重最高, 相对路径只是辅助信号(长文本容易拼出低分噪声)
      keys: [
        {name: 'name', weight: 2},
        {name: 'py', weight: 1},
        {name: 'pyFirst', weight: 0.5},
        {name: 'relPath', weight: 0.3},
      ],
      // 实测 0.25 可挡住纯噪声(如搜 01coder 时的 2021 code, 展示分 0.61)且不误伤拼音命中
      threshold: 0.25,
      // 短名中间位置的匹配不该被位置罚分, 否则长路径里靠前的噪声反而分更高
      ignoreLocation: true,
    })
  }

  // #region 树结构查询

  get root(): DirNode {
    return this.nodeByPath.get(this.rootPath)!
  }

  get totalCount(): number {
    return this.nodes.length
  }

  nodeAt(fullPath: string): DirNode | undefined {
    return this.nodeByPath.get(fullPath)
  }

  childrenOf(fullPath: string): DirNode[] {
    return this.childrenByParent.get(fullPath) ?? []
  }

  parentOf(fullPath: string): DirNode | undefined {
    const node = this.nodeByPath.get(fullPath)
    if (!node || node.parentPath === null) return undefined
    return this.nodeByPath.get(node.parentPath)
  }

  // #endregion

  // #region 全树模糊搜索与参数直达

  /** 全树模糊搜索(中文名/全拼/首字母/相对路径), 名称包含查询词的恒排最前 */
  search(query: string, limit = 50): DirNode[] {
    if (query.trim() === '') return []
    const hits = this.fuse.search(query, {limit}).map((r) => r.item.node)

    // 显式相关性排序: 名称直接包含查询词的最强相关, 其余模糊命中沉底(各自仍按 Fuse 分数序)
    const needle = query.toLowerCase()
    const direct = hits.filter((n) => n.name.toLowerCase().includes(needle))
    const fuzzy = hits.filter((n) => !n.name.toLowerCase().includes(needle))
    return [...direct, ...fuzzy]
  }

  /**
   * 参数直达用: 尽可能把输入解析成唯一目标目录。
   * 优先精确路径命中, 其次唯一同名目录, 最后唯一模糊匹配。
   */
  findUniqueMatch(query: string): DirNode | undefined {
    const normalized = query.replaceAll('\\', '/')

    // 精确命中 relPath / fullPath 时直接返回
    const exactPath = this.nodes.find((n) => (n.relPath === normalized || n.fullPath === query))
    if (exactPath) return exactPath

    // 同名目录唯一才可直达, 重名时交给交互式浏览器消歧
    const nameMatches = this.nodes.filter((n) => n.name === query)
    if (nameMatches.length === 1) return nameMatches[0]
    if (nameMatches.length > 1) return undefined

    const fuzzyMatches = this.search(query)
    return fuzzyMatches.length === 1 ? fuzzyMatches[0] : undefined
  }

  // #endregion

  // #region 扫描构建索引

  private scan(): void {
    // 根节点以占位名展示, 其 fullPath 仍指向真实根目录
    this.registerNode({
      depth: -1,
      fullPath: this.rootPath,
      name: '（根目录）',
      parentPath: null,
      relPath: '（根目录）',
    })
    this.walk(this.rootPath, 0)
  }

  private walk(dirPath: string, depth: number): void {
    // 隐藏目录(.git/.vttflow 等)不是导航目标, 不进索引
    const dirNames = readdirSync(dirPath, {withFileTypes: true})
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => e.name)

    for (const name of dirNames) {
      const fullPath = join(dirPath, name)
      this.registerNode({
        depth,
        fullPath,
        name,
        parentPath: dirPath,
        relPath: relative(this.rootPath, fullPath).split(sep).join('/'),
      })
      this.walk(fullPath, depth + 1)
    }
  }

  private registerNode(node: DirNode): void {
    this.nodes.push(node)
    this.nodeByPath.set(node.fullPath, node)

    const siblings = node.parentPath === null ? undefined : this.childrenByParent.get(node.parentPath)
    if (siblings) {
      siblings.push(node)
    } else if (node.parentPath !== null) {
      this.childrenByParent.set(node.parentPath, [node])
    }

    // 拼音索引在扫描时预计算, 避免搜索时反复调用 pinyin
    this.searchEntries.push({
      name: node.name,
      node,
      py: pinyin(node.name, {toneType: 'none', type: 'string'}).replaceAll(' ', ''),
      pyFirst: pinyin(node.name, {pattern: 'first', toneType: 'none', type: 'string'}).replaceAll(' ', ''),
      relPath: node.relPath,
    })
  }

  // #endregion
}
