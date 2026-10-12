import {type Terminal} from '@earendil-works/pi-tui'
import {expect} from 'chai'
import {mkdirSync, mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {browseDirectory} from '../../../src/lib/dl/browse-directory.js'
import {DirectoryIndex} from '../../../src/lib/dl/directory-index.js'

// 终端原始按键序列(legacy 转义序列); 控制字符用 fromCodePoint 构造, 避免源码出现不可见字符
const ESC = String.fromCodePoint(27)
const KEY_DOWN = ESC + '[B'
const KEY_TAB = String.fromCodePoint(9)
const KEY_ENTER = String.fromCodePoint(13)
const KEY_CTRL_C = String.fromCodePoint(3)

// 活动栏高亮行的着色前缀(cyan('› 名称'))
const CYAN_MARK = ESC + '[36m› '

/** 伪终端: 记录所有写到终端的输出, 并可模拟按键输入, 用于驱动真实 TUI 装配链路 */
class FakeTerminal implements Terminal {
  public written: string[] = []
  private inputHandler: ((data: string) => void) | undefined

  start(onInput: (data: string) => void, _onResize: () => void): void {
    this.inputHandler = onInput
  }

  stop(): void {
    // 无需清理
  }

  drainInput(_maxMs?: number, _idleMs?: number): Promise<void> {
    return Promise.resolve()
  }

  write(data: string): void {
    this.written.push(data)
  }

  get columns(): number {
    return 120
  }

  get rows(): number {
    return 30
  }

  get kittyProtocolActive(): boolean {
    return false
  }

  moveBy(_lines: number): void {
    // 无需移动
  }

  hideCursor(): void {
    // 无需处理
  }

  showCursor(): void {
    // 无需处理
  }

  clearLine(): void {
    // 无需处理
  }

  clearFromCursor(): void {
    // 无需处理
  }

  clearScreen(): void {
    // 无需处理
  }

  setTitle(_title: string): void {
    // 无需处理
  }

  setProgress(_active: boolean): void {
    // 无需处理
  }

  /** 模拟一次按键 */
  feed(data: string): void {
    this.inputHandler?.(data)
  }

  get output(): string {
    return this.written.join('')
  }

  get writeCount(): number {
    return this.written.length
  }
}

/** 等待 pi-tui 的异步渲染调度(节流 16ms + nextTick)完成 */
function waitForRender(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 100)
  })
}

// fixture 目录树:
// root/
//   x/{youtube/视频A, bilibili}
//   y/中文目录
describe('browseDirectory 真实装配链路(伪终端)', () => {
  let rootPath: string
  let index: DirectoryIndex

  before(() => {
    rootPath = mkdtempSync(join(tmpdir(), 'vptool-browser-tui-'))
    for (const dir of ['x/youtube/视频A', 'x/bilibili', 'y/中文目录']) {
      mkdirSync(join(rootPath, dir), {recursive: true})
    }

    index = new DirectoryIndex(rootPath)
  })

  after(() => {
    rmSync(rootPath, {recursive: true, force: true})
  })

  // #region 重绘链路(回归: 方向键/Tab 按下后画面无更新, 只有 Esc 能退出)

  it('按键移动高亮后必须触发重绘并更新画面', async () => {
    const terminal = new FakeTerminal()
    const browsePromise = browseDirectory(index, undefined, terminal)
    await waitForRender() // 等首帧渲染完成

    const writesBeforeKeys = terminal.writeCount
    terminal.feed(KEY_TAB) // 焦点 -> 第二栏(列出 x 的子目录)
    terminal.feed(KEY_DOWN) // 第二栏高亮: bilibili -> youtube
    await waitForRender()
    // 退出前取样, 避免 stop() 的收尾输出混入
    const writesAfterKeys = terminal.writeCount

    terminal.feed(KEY_CTRL_C) // 收尾退出浏览器
    await browsePromise

    // 核心断言: 按键后终端必须收到新的重绘输出, 否则画面"没反应"
    expect(writesAfterKeys, '按键后没有任何重绘输出(画面无更新)').to.be.greaterThan(writesBeforeKeys)

    // 高亮必须移动到第二栏第二项 youtube(cyan 前缀即活动栏高亮)
    const youtubeName = index.childrenOf(index.childrenOf(rootPath)[0].fullPath)[1].name
    expect(terminal.output).to.include(CYAN_MARK + youtubeName)
  })

  // #endregion

  // #region 选中与取消

  it('第一栏 Enter 选中根目录下的首个子目录', async () => {
    const terminal = new FakeTerminal()
    const browsePromise = browseDirectory(index, undefined, terminal)
    await waitForRender()

    terminal.feed(KEY_ENTER)
    const picked = await browsePromise

    expect(picked).to.equal(index.childrenOf(rootPath)[0].fullPath)
  })

  it('第二栏 Enter 选中 x 的子目录', async () => {
    const terminal = new FakeTerminal()
    const browsePromise = browseDirectory(index, undefined, terminal)
    await waitForRender()

    terminal.feed(KEY_TAB) // 焦点 -> 第二栏
    terminal.feed(KEY_ENTER)
    const picked = await browsePromise

    const xPath = index.childrenOf(rootPath)[0].fullPath
    expect(picked).to.equal(index.childrenOf(xPath)[0].fullPath)
  })

  it('Esc 取消浏览并返回 undefined', async () => {
    const terminal = new FakeTerminal()
    const browsePromise = browseDirectory(index, undefined, terminal)
    await waitForRender()

    terminal.feed(ESC)
    const picked = await browsePromise

    expect(picked).to.equal(undefined)
  })

  // #endregion
})