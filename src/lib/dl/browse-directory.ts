import {
  type Component,
  CURSOR_MARKER,
  decodeKittyPrintable,
  type Focusable,
  Key,
  matchesKey,
  ProcessTerminal,
  type Terminal,
  truncateToWidth,
  TuiMainScreen,
  visibleWidth,
} from '@earendil-works/pi-tui'

import {type DirNode, type DirectoryIndex} from './directory-index.js'

// #region ANSI 上色助手
const ESC = String.fromCodePoint(27) // 转义序列起始符, 用函数构造避免源码里出现不可见控制字符
const cyan = (s: string): string => `${ESC}[36m${s}${ESC}[0m`
const gray = (s: string): string => `${ESC}[90m${s}${ESC}[0m`
const bold = (s: string): string => `${ESC}[1m${s}${ESC}[0m`
// #endregion

type BrowserMode = 'browse' | 'search'
type BrowserAction = 'cancel' | 'select'
type ViewAction = BrowserAction | undefined

const COLUMN_COUNT = 4 // 同屏 4 栏, 列出 4 个连续层级的目录

// 单栏渲染参数
interface ColumnSpec {
  highlight: number
  isActive: boolean
  items: DirNode[]
  scroll: number
}

// 单栏派生数据: anchor 是该栏列出其子项的父目录, items = anchor 的子目录
interface ColumnData {
  anchor: DirNode | undefined
  highlightIndex: number
  items: DirNode[]
}

function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.min(Math.max(value, minValue), maxValue)
}

/** 在目录列表中定位路径, 找不到时回到首项 */
function indexOrFirst(items: DirNode[], fullPath: string): number {
  return Math.max(items.findIndex((n) => n.fullPath === fullPath), 0)
}

/** 生成 4 个栏各自独立的滚动起点(全 0) */
function createZeroScrolls(): number[] {
  return Array.from({length: COLUMN_COUNT}, () => 0)
}

/** 计算滚动窗口起点, 保证高亮项可见 */
function scrollToVisible(scroll: number, highlight: number, visibleRows: number): number {
  if (highlight < scroll) return highlight
  if (highlight >= (scroll + visibleRows)) return (highlight - visibleRows) + 1
  return scroll
}

/** 按终端显示宽度(CJK 双宽安全)补齐到固定列宽 */
function padVisible(text: string, width: number): string {
  const padding = Math.max(0, width - visibleWidth(text))
  return text + ' '.repeat(padding)
}

/**
 * 4 栏目录浏览器视图(经典 Miller columns 状态机 + 渲染一体):
 * 第 0 栏列出窗口根的(默认即工作目录根)子目录, 第 N 栏列出第 N-1 栏高亮项的子目录,
 * 因此打开即看到根目录的所有子目录, 一路向右下钻。列数固定为 4, 深度超过 4 层时
 * 窗口在深度轴上滑动(最右栏再按 → 整窗下滚, 最左栏再按 ← 整窗上滚)。
 * 按键驱动状态转移, render 只是状态的纯投影; 不启动 TUI 也可直接单测。
 */
export class DirectoryBrowserView implements Component, Focusable {
  public focused = false
  private activeColumnIndex = 0 // 默认聚焦第一栏(根目录的子目录)
  private highlights: number[] = createZeroScrolls() // 各栏高亮索引
  private mode: BrowserMode = 'browse'
  private query = ''
  private scrolls: number[] = createZeroScrolls()
  private searchIndex = 0
  private searchScroll = 0
  private selectedPath: string | undefined
  private windowRoot: DirNode // 第 0 栏所列出子项的父目录

  constructor(
    private readonly index: DirectoryIndex,
    initialQuery?: string,
    private readonly onAction?: (action: BrowserAction, pickedPath: string | undefined) => void,
  ) {
    this.windowRoot = index.root

    // 初始查询: 有匹配时直接进搜索模式展示结果
    if (initialQuery && initialQuery.trim() !== '') {
      this.query = initialQuery
      if (this.searchResults().length > 0) this.mode = 'search'
    }
  }

  // #region 只读状态(供装配层与测试读取)

  /** 活动栏高亮目录的路径(Enter 将要进入的目录) */
  get focusedDirPath(): string {
    const active = this.buildColumns()[this.activeColumnIndex]
    return (active.items[active.highlightIndex] ?? active.anchor ?? this.index.root).fullPath
  }

  get pickedPath(): string | undefined {
    return this.selectedPath
  }

  get isSearchMode(): boolean {
    return this.mode === 'search'
  }

  /** 当前活动栏索引(0..3), 供测试断言焦点位置 */
  get activeColumn(): number {
    return this.activeColumnIndex
  }

  /** 第 0 栏所列出子项的父目录路径(即窗口根), 供测试断言整窗平移 */
  get windowRootPath(): string {
    return this.windowRoot.fullPath
  }

  // #endregion

  // #region 栏数据推导

  /** 从当前目录沿 parentPath 回溯出根到该目录的完整链 */
  private buildChainTo(node: DirNode): DirNode[] {
    const chain: DirNode[] = []
    let cursor: DirNode | undefined = node
    while (cursor) {
      chain.unshift(cursor)
      cursor = (cursor.parentPath === null) ? undefined : this.index.nodeAt(cursor.parentPath)
    }

    return chain
  }

  /** 栏 k 的父目录: 从窗口根沿各栏高亮索引逐层下推 */
  private anchorAt(columnIndex: number): DirNode | undefined {
    let node: DirNode | undefined = this.windowRoot
    for (let k = 0; ((k < columnIndex) && (node !== undefined)); k++) {
      node = this.index.childrenOf(node.fullPath)[this.highlights[k]]
    }

    return node
  }

  /** 派生 4 栏数据: 第 N 栏 = 第 N-1 栏高亮项的子目录 */
  private buildColumns(): ColumnData[] {
    const columns: ColumnData[] = []
    for (let k = 0; k < COLUMN_COUNT; k++) {
      const anchor = this.anchorAt(k)
      const items = anchor ? this.index.childrenOf(anchor.fullPath) : []
      const highlightIndex = clamp(this.highlights[k], 0, Math.max((items.length - 1), 0))
      columns.push({anchor, highlightIndex, items})
    }

    return columns
  }

  private searchResults(): DirNode[] {
    return this.index.search(this.query)
  }

  // #endregion

  // #region 按键状态转移

  /**
   * pi-tui 焦点组件的输入入口: 处理完按键后框架会自动调度重绘,
   * select/cancel 通过 onAction 回调上报给装配层收尾。
   */
  handleInput(data: string): void {
    const action = this.handleKey(data)
    if (action !== undefined) this.onAction?.(action, this.selectedPath)
  }

  handleKey(data: string): ViewAction {
    // #region 控制键: Ctrl+C 一律取消, Esc 搜索模式下先退回浏览
    if (matchesKey(data, Key.ctrl('c'))) return this.cancel()
    if (matchesKey(data, Key.escape)) {
      if (this.mode === 'search') {
        this.exitSearch()
        return undefined
      }

      return this.cancel()
    }
    // #endregion

    return this.mode === 'search' ? this.handleSearchKey(data) : this.handleBrowseKey(data)
  }

  private handleSearchKey(data: string): ViewAction {
    // #region 列表导航与跳转
    if (matchesKey(data, Key.enter)) {
      this.jumpToSearchResult()
      return undefined
    }

    if (matchesKey(data, Key.up)) {
      this.searchIndex = clamp((this.searchIndex - 1), 0, Math.max((this.searchResults().length - 1), 0))
      return undefined
    }

    if (matchesKey(data, Key.down)) {
      this.searchIndex = clamp((this.searchIndex + 1), 0, Math.max((this.searchResults().length - 1), 0))
      return undefined
    }
    // #endregion

    // #region 查询词编辑: 删空自动退回浏览模式
    if (matchesKey(data, Key.backspace) || matchesKey(data, Key.delete)) {
      this.query = this.query.slice(0, -1)
      this.searchIndex = 0
      this.searchScroll = 0
      if (this.query.length === 0) this.exitSearch()
      return undefined
    }

    const text = this.extractPrintable(data)
    if (text !== '') {
      this.query += text
      this.searchIndex = 0
      this.searchScroll = 0
    }
    // #endregion

    return undefined
  }

  private handleBrowseKey(data: string): ViewAction {
    // #region 栏间导航与整窗平移
    if (matchesKey(data, Key.tab)) {
      this.activeColumnIndex = (this.activeColumnIndex + 1) % COLUMN_COUNT
      return undefined
    }

    if (matchesKey(data, Key.up)) {
      this.moveInActiveColumn(-1)
      return undefined
    }

    if (matchesKey(data, Key.down)) {
      this.moveInActiveColumn(1)
      return undefined
    }

    if (matchesKey(data, Key.left)) {
      // 未到最左栏则左移焦点, 已在最左栏则整窗上滚一层
      if (this.activeColumnIndex > 0) this.activeColumnIndex -= 1
      else this.scrollWindowUp()
      return undefined
    }

    if (matchesKey(data, Key.right)) {
      if (this.activeColumnIndex < (COLUMN_COUNT - 1)) {
        // 高亮目录没有可进入的子目录时禁止向右(避免焦点落到空栏)
        const active = this.buildColumns()[this.activeColumnIndex]
        const highlighted = active.items[active.highlightIndex]
        if (highlighted && this.index.childrenOf(highlighted.fullPath).length > 0) this.activeColumnIndex += 1
      } else {
        this.scrollWindowDown()
      }

      return undefined
    }
    // #endregion

    // #region 确认与全树搜索入口
    if (matchesKey(data, Key.enter)) return this.select()

    const text = this.extractPrintable(data)
    if (text !== '' && text.trim() !== '') {
      this.mode = 'search'
      this.query = text
      this.searchIndex = 0
      this.searchScroll = 0
    }
    // #endregion

    return undefined
  }

  /** 在活动栏内移动高亮, 并刷新其右侧各栏(回到首项) */
  private moveInActiveColumn(delta: number): void {
    const columns = this.buildColumns()
    const active = columns[this.activeColumnIndex]
    if (active.items.length === 0) return // 空栏不响应

    const next = clamp((active.highlightIndex + delta), 0, (active.items.length - 1))
    if (next === active.highlightIndex) return

    this.highlights[this.activeColumnIndex] = next
    for (let k = (this.activeColumnIndex + 1); k < COLUMN_COUNT; k++) this.highlights[k] = 0
  }

  /** 整窗下滚一层: 第 0 栏高亮项成为新窗口根, 其余各栏随之左移; 最深处目录无子目录时不动 */
  private scrollWindowDown(): void {
    // 锚点链走满 4 步即第 4 栏高亮项, 只有它还有子目录(存在第 5 层内容)时下滚才有意义
    const deepest = this.anchorAt(COLUMN_COUNT)
    if (!deepest || this.index.childrenOf(deepest.fullPath).length === 0) return
    this.windowRoot = this.anchorAt(1)!
    this.highlights = [this.highlights[1], this.highlights[2], this.highlights[3], 0]
  }

  /** 整窗上滚一层: 窗口根退到其父目录, 高亮停在原窗口根 */
  private scrollWindowUp(): void {
    const parent = this.index.parentOf(this.windowRoot.fullPath)
    if (!parent) return
    const windowRootIndex = indexOrFirst(this.index.childrenOf(parent.fullPath), this.windowRoot.fullPath)
    this.windowRoot = parent
    this.highlights = [windowRootIndex, this.highlights[0], this.highlights[1], this.highlights[2]]
  }

  /** Enter: 选中活动栏高亮目录(空栏时退回该栏父目录) */
  private select(): ViewAction {
    this.selectedPath = this.focusedDirPath
    return 'select'
  }

  /** 搜索 Enter: 跳转到匹配目录(回到浏览模式并聚焦其所在栏), 再按 Enter 确认进入 */
  private jumpToSearchResult(): void {
    const target = this.searchResults()[this.searchIndex]
    if (!target) return
    this.focusDirectory(target)
    this.mode = 'browse'
    this.query = ''
    this.scrolls = createZeroScrolls()
    this.searchIndex = 0
    this.searchScroll = 0
  }

  /**
   * 把窗口定位到目标目录: 窗口根取目标上方最多 4 层, 目标落在可见栏内,
   * 各栏高亮沿目标路径设置, 活动栏聚焦目标所在栏。
   */
  private focusDirectory(target: DirNode): void {
    const chain = this.buildChainTo(target) // chain[0] 为根, chain 末项即 target
    const targetIndex = chain.length - 1
    const windowStart = Math.max((targetIndex - COLUMN_COUNT), 0)

    this.windowRoot = chain[windowStart]
    this.highlights = createZeroScrolls()
    for (let k = 0; k < COLUMN_COUNT; k++) {
      const next = chain[windowStart + k + 1]
      if (!next) break
      this.highlights[k] = indexOrFirst(this.index.childrenOf(chain[windowStart + k].fullPath), next.fullPath)
    }

    this.activeColumnIndex = clamp((targetIndex - windowStart - 1), 0, (COLUMN_COUNT - 1))
  }

  private exitSearch(): void {
    this.mode = 'browse'
    this.query = ''
    this.searchIndex = 0
    this.searchScroll = 0
  }

  private cancel(): ViewAction {
    this.selectedPath = undefined
    return 'cancel'
  }

  /** 提取可打印文本(兼容 Kitty 协议与普通终端, 支持粘贴多字符) */
  private extractPrintable(data: string): string {
    const kittyText = decodeKittyPrintable(data)
    if (kittyText) return kittyText
    return /^[\p{L}\p{N}\p{P}\p{S} ]+$/u.test(data) ? data : ''
  }

  // #endregion

  // #region 渲染

  invalidate(): void {
    // 无渲染缓存, 无需处理
  }

  render(width: number): string[] {
    const listRows = Math.max(3, (process.stdout.rows ?? 24) - 6)
    // 提示行较长, 窄终端下也必须截断(pi-tui 检测到超宽行会直接抛错)
    const hint = gray('↑↓ 移动  ←→ 切栏/(最左)上滚/(最右)下滚  Tab 切栏  Enter 进入选中目录  直接输入=全树搜索  Esc 取消')
    const lines = [
      bold(cyan('选择要进入的目录')),
      truncateToWidth(hint, width),
      '',
    ]
    const bodyLines = this.mode === 'search' ? this.renderSearch(width, listRows) : this.renderColumns(width, listRows)
    lines.push(...bodyLines, '')

    // #region 状态栏: 选中路径与统计
    const selectedLabel = truncateToWidth(`选中: ${this.focusedDirPath}`, width)
    const statsLabel = gray(`共 ${this.index.totalCount} 个目录 · 焦点: 第${this.activeColumnIndex + 1}栏`)
    lines.push(gray(selectedLabel), statsLabel)
    // #endregion

    return lines
  }

  /** 浏览模式: 4 栏逐行交错拼接 */
  private renderColumns(width: number, listRows: number): string[] {
    // #region 栏宽分配(含 3 个分隔符)
    const separator = gray(' │ ')
    const separatorWidth = visibleWidth(' │ ')
    const columns = this.buildColumns()
    const separatorTotal = separatorWidth * (COLUMN_COUNT - 1)
    const baseWidth = Math.floor((width - separatorTotal) / COLUMN_COUNT)
    const widths = Array.from({length: COLUMN_COUNT}, (_unused, i) =>
      (i === (COLUMN_COUNT - 1)) ? (width - separatorTotal - (baseWidth * (COLUMN_COUNT - 1))) : baseWidth)
    // #endregion

    // #region 各栏行(保证高亮可见的滚动窗口)
    const columnLines = columns.map((col, i) => {
      this.scrolls[i] = scrollToVisible(this.scrolls[i], col.highlightIndex, listRows)
      return this.renderColumnLines(
        {highlight: col.highlightIndex, isActive: i === this.activeColumnIndex, items: col.items, scroll: this.scrolls[i]},
        widths[i],
        listRows,
      )
    })
    // #endregion

    const rows: string[] = []
    for (let i = 0; i < listRows; i++) {
      rows.push(columnLines.map((lines) => lines[i]).join(separator))
    }

    return rows
  }

  private renderColumnLines(spec: ColumnSpec, columnWidth: number, listRows: number): string[] {
    const {highlight, isActive, items, scroll} = spec
    const lines: string[] = []
    for (let i = 0; i < listRows; i++) {
      const item = items[scroll + i]
      if (!item) {
        lines.push(padVisible('', columnWidth))
        continue
      }

      const isHighlighted = (scroll + i) === highlight
      const marker = isHighlighted ? '› ' : '  '
      const body = truncateToWidth(marker + item.name, columnWidth)
      // 高亮行: 仅活动栏亮色, 保证能看出焦点所在
      lines.push(isHighlighted && isActive ? padVisible(cyan(body), columnWidth) : padVisible(body, columnWidth))
    }

    // 空栏提示
    if (items.length === 0) {
      lines[0] = padVisible(gray('（无）'), columnWidth)
    }

    return lines
  }

  /** 搜索模式: 全树匹配结果列表 */
  private renderSearch(width: number, listRows: number): string[] {
    const results = this.searchResults()
    const lines = [this.renderQueryLine(width), '']

    // #region 结果行(滚动窗口 + 高亮)
    this.searchScroll = scrollToVisible(this.searchScroll, this.searchIndex, listRows)
    if (results.length === 0) {
      lines.push(gray(`无匹配: ${this.query}`))
    } else {
      for (let i = 0; i < listRows; i++) {
        const item = results[this.searchScroll + i]
        if (!item) {
          lines.push('')
          continue
        }

        const rowNo = String(this.searchScroll + i + 1).padStart(2, ' ')
        const isHighlighted = (this.searchScroll + i) === this.searchIndex
        const body = truncateToWidth(`${rowNo} › ${item.relPath}`, width)
        lines.push(isHighlighted ? cyan(body) : body)
      }
    }
    // #endregion

    lines.push(gray(`共 ${results.length} 条匹配 · Enter 跳转到匹配目录 · Esc 返回浏览`))
    return lines
  }

  private renderQueryLine(width: number): string {
    const line = cyan(`搜索: ${this.query}`)
    // 聚焦时输出光标标记, 让终端把 IME 候选窗定位到查询词末尾
    return this.focused ? `${truncateToWidth(line, width)}${CURSOR_MARKER}` : truncateToWidth(line, width)
  }

  // #endregion
}

/**
 * 打开 4 栏目录浏览器, 返回选中目录路径; 取消时返回 undefined。
 * @param index - 已构建的目录索引
 * @param initialQuery - 初始搜索词(来自命令行参数), 有匹配时直接进入搜索模式
 * @param terminal - 终端实现, 默认真实进程终端; 测试可注入伪终端驱动交互
 */
export function browseDirectory(
  index: DirectoryIndex,
  initialQuery?: string,
  terminal: Terminal = new ProcessTerminal(),
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const tui = new TuiMainScreen(terminal)

    // 按键走焦点组件的 handleInput 通道(框架处理完自动重绘), select/cancel 经回调收尾退出
    const view = new DirectoryBrowserView(index, initialQuery, (action, pickedPath) => {
      tui.stop()
      resolve(action === 'select' ? pickedPath : undefined)
    })

    tui.addChild(view)
    tui.setFocus(view)
    tui.start()
  })
}