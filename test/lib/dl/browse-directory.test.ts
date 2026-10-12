import {visibleWidth} from '@earendil-works/pi-tui'
import {expect} from 'chai'
import {mkdirSync, mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {DirectoryBrowserView} from '../../../src/lib/dl/browse-directory.js'
import {DirectoryIndex} from '../../../src/lib/dl/directory-index.js'

// 终端原始按键序列(legacy 转义序列); 控制字符用 fromCodePoint 构造, 避免源码出现不可见字符
const ESC = String.fromCodePoint(27)
const KEY_UP = ESC + '[A'
const KEY_DOWN = ESC + '[B'
const KEY_RIGHT = ESC + '[C'
const KEY_LEFT = ESC + '[D'
const KEY_ENTER = String.fromCodePoint(13)
const KEY_TAB = String.fromCodePoint(9)
const KEY_BACKSPACE = String.fromCodePoint(127)
const KEY_CTRL_C = String.fromCodePoint(3)

const NEWLINE = String.fromCodePoint(10)

/** 让 4 栏都有内容: 焦点移到第二栏并把高亮落到 youtube(其下有 视频A/视频B) */
function showFourColumns(view: DirectoryBrowserView): void {
  view.handleKey(KEY_RIGHT) // 焦点 -> 第二栏
  view.handleKey(KEY_DOWN) // 第二栏高亮: bilibili -> youtube
}

// fixture 目录树(深度 5, 覆盖整窗滑动; bilibili 物理上只有隐藏目录 .git, 应视为叶子):
// root/
//   x/
//     youtube/
//       视频A/1080p/高清
//       视频B/720p
//     bilibili/.git
//   y/中文目录
describe('DirectoryBrowserView(4 栏 Miller columns)', () => {
  let rootPath: string
  let index: DirectoryIndex

  before(() => {
    rootPath = mkdtempSync(join(tmpdir(), 'vptool-browser-'))
    for (const dir of ['x/youtube/视频A/1080p/高清', 'x/youtube/视频B/720p', 'x/bilibili/.git', 'y/中文目录']) {
      mkdirSync(join(rootPath, dir), {recursive: true})
    }

    index = new DirectoryIndex(rootPath)
  })

  after(() => {
    rmSync(rootPath, {recursive: true, force: true})
  })

  function createView(initialQuery?: string): DirectoryBrowserView {
    return new DirectoryBrowserView(index, initialQuery)
  }

  // #region 第一栏 = 根目录的子目录

  it('默认聚焦第一栏, 且第一栏直接列出根目录的所有子目录', () => {
    const view = createView()
    expect(view.activeColumn).to.equal(0)
    expect(view.windowRootPath).to.equal(rootPath) // 窗口根即工作目录根
    expect(view.focusedDirPath).to.equal(join(rootPath, 'x'))

    view.handleKey(KEY_DOWN)
    expect(view.focusedDirPath).to.equal(join(rootPath, 'y')) // 第一栏在 x/y 之间移动

    view.handleKey(KEY_UP)
    expect(view.focusedDirPath).to.equal(join(rootPath, 'x'))
  })

  it('第一栏 Enter 选中根目录下的子目录', () => {
    const view = createView()
    expect(view.handleKey(KEY_ENTER)).to.equal('select')
    expect(view.pickedPath).to.equal(join(rootPath, 'x'))
  })

  // #endregion

  // #region 栏间导航与高亮

  it('→ 右移焦点(逐栏有子目录时), Tab 循环切栏', () => {
    const view = createView()
    expect(view.activeColumn).to.equal(0)
    showFourColumns(view) // 焦点 -> 第二栏并高亮 youtube(有子目录)
    view.handleKey(KEY_RIGHT) // youtube 有子目录 -> 焦点 -> 第三栏
    view.handleKey(KEY_RIGHT) // 视频A 有子目录 -> 焦点 -> 第四栏
    expect(view.activeColumn).to.equal(3)
    view.handleKey(KEY_TAB)
    expect(view.activeColumn).to.equal(0)
  })

  it('移动某栏高亮会刷新其右侧各栏', () => {
    const view = createView()
    view.handleKey(KEY_RIGHT) // 焦点 -> 第二栏
    view.handleKey(KEY_DOWN) // 第二栏高亮: bilibili -> youtube
    expect(view.focusedDirPath).to.equal(join(rootPath, 'x', 'youtube'))

    const text = view.render(140).join(NEWLINE)
    expect(text).to.include('视频A') // 第三栏 = youtube 的子目录
    expect(text).to.include('1080p') // 第四栏 = 视频A 的子目录
  })

  it('第三栏 Enter 选中子目录', () => {
    const view = createView()
    showFourColumns(view) // 第二栏高亮 youtube
    view.handleKey(KEY_RIGHT) // 焦点 -> 第三栏(视频A/视频B)
    view.handleKey(KEY_ENTER)
    expect(view.pickedPath).to.equal(join(rootPath, 'x', 'youtube', '视频A'))
  })

  it('高亮目录无可进入子目录(无子目录或仅有隐藏目录)时禁止向右', () => {
    const view = createView()
    const text = view.render(140).join(NEWLINE)
    expect(text).to.not.include('.git') // 隐藏目录不进列表

    view.handleKey(KEY_RIGHT) // 焦点 -> 第二栏, 高亮 bilibili(物理上只有 .git)
    expect(view.activeColumn).to.equal(1)
    view.handleKey(KEY_RIGHT) // bilibili 无可进入子目录 -> 禁止向右
    expect(view.activeColumn).to.equal(1)
  })

  it('最右栏按 → 时最深处目录无子目录则窗口不滑动', () => {
    const view = createView()
    view.handleKey(KEY_RIGHT) // 焦点 -> 第二栏
    view.handleKey(KEY_DOWN) // 高亮 youtube
    view.handleKey(KEY_RIGHT) // 焦点 -> 第三栏(youtube 有子目录, 允许)
    view.handleKey(KEY_DOWN) // 第三栏高亮: 视频A -> 视频B
    view.handleKey(KEY_RIGHT) // 焦点 -> 第四栏(视频B 有子目录 720p, 允许)
    expect(view.activeColumn).to.equal(3)
    view.handleKey(KEY_RIGHT) // 最深处 720p 无子目录 -> 禁止整窗下滚
    expect(view.windowRootPath).to.equal(rootPath)
  })

  it('第四栏 Enter 选中更深一层目录', () => {
    const view = createView()
    showFourColumns(view)
    view.handleKey(KEY_RIGHT) // 焦点 -> 第三栏
    view.handleKey(KEY_RIGHT) // 焦点 -> 第四栏(1080p)
    expect(view.activeColumn).to.equal(3)
    view.handleKey(KEY_ENTER)
    expect(view.pickedPath).to.equal(join(rootPath, 'x', 'youtube', '视频A', '1080p'))
  })

  it('第三栏移动高亮后第四栏内容随之刷新', () => {
    const view = createView()
    showFourColumns(view)
    view.handleKey(KEY_RIGHT) // 焦点 -> 第三栏
    view.handleKey(KEY_DOWN) // 第三栏高亮: 视频A -> 视频B

    const text = view.render(140).join(NEWLINE)
    expect(text).to.include('720p') // 第四栏已刷新为 视频B 的子目录
    expect(text).to.not.include('1080p')

    view.handleKey(KEY_ENTER)
    expect(view.pickedPath).to.equal(join(rootPath, 'x', 'youtube', '视频B'))
  })

  // #endregion

  // #region 整窗在深度轴上滑动

  it('最右栏再按 → 整窗下滚一层', () => {
    const view = createView()
    showFourColumns(view)
    view.handleKey(KEY_RIGHT)
    view.handleKey(KEY_RIGHT)
    expect(view.windowRootPath).to.equal(rootPath)
    view.handleKey(KEY_RIGHT) // 最右栏再右移 -> 整窗下滚
    expect(view.windowRootPath).to.equal(join(rootPath, 'x')) // 第一栏变为 x 的子目录
  })

  it('最左栏再按 ← 整窗上滚一层', () => {
    const view = createView()
    showFourColumns(view)
    view.handleKey(KEY_RIGHT)
    view.handleKey(KEY_RIGHT)
    view.handleKey(KEY_RIGHT) // 整窗下滚: 窗口根 -> x
    expect(view.windowRootPath).to.equal(join(rootPath, 'x'))

    view.handleKey(KEY_LEFT) // 焦点 -> 第三栏
    view.handleKey(KEY_LEFT) // 焦点 -> 第二栏
    view.handleKey(KEY_LEFT) // 焦点 -> 第一栏
    view.handleKey(KEY_LEFT) // 最左栏再左移 -> 整窗上滚
    expect(view.windowRootPath).to.equal(rootPath)
  })

  // #endregion

  // #region 全树搜索与跳转

  it('浏览模式直接输入进入搜索模式', () => {
    const view = createView()
    view.handleKey('z')
    expect(view.isSearchMode).to.equal(true)
  })

  it('搜索 Enter 跳转并聚焦匹配目录', () => {
    const view = createView('zhongwenmulu')
    expect(view.isSearchMode).to.equal(true)
    view.handleKey(KEY_ENTER)
    expect(view.isSearchMode).to.equal(false)
    expect(view.focusedDirPath).to.equal(join(rootPath, 'y', '中文目录'))

    view.handleKey(KEY_ENTER)
    expect(view.pickedPath).to.equal(join(rootPath, 'y', '中文目录'))
  })

  it('跳转到深层目录时窗口滑到该层', () => {
    const view = createView('gaoqing')
    view.handleKey(KEY_ENTER)
    expect(view.windowRootPath).to.equal(join(rootPath, 'x')) // 窗口根上移到 x
    expect(view.focusedDirPath).to.equal(join(rootPath, 'x', 'youtube', '视频A', '1080p', '高清'))
  })

  it('搜索模式 Esc 退回浏览, 浏览模式 Esc 取消', () => {
    const view = createView('zhongwenmulu')
    expect(view.handleKey(ESC)).to.equal(undefined)
    expect(view.isSearchMode).to.equal(false)
    expect(view.handleKey(ESC)).to.equal('cancel')
    expect(view.pickedPath).to.equal(undefined)
  })

  it('退格删空查询词自动退回浏览模式', () => {
    const view = createView()
    view.handleKey('z')
    expect(view.handleKey(KEY_BACKSPACE)).to.equal(undefined)
    expect(view.isSearchMode).to.equal(false)
  })

  it('Ctrl+C 一律取消', () => {
    const view = createView('zhongwenmulu')
    expect(view.handleKey(KEY_CTRL_C)).to.equal('cancel')
  })

  // #endregion

  // #region 渲染冒烟

  it('启动即渲染第一栏内容; 叶子目录后的栏显示空提示', () => {
    const view = createView()
    const text = view.render(140).join(NEWLINE)
    expect(text).to.include('x') // 第一栏 = 根目录的子目录
    expect(text).to.include('（无）') // bilibili 无子目录, 后两栏为空
    expect(text).to.include(`选中: ${join(rootPath, 'x')}`)
  })

  it('4 栏均有内容时可同时看到各层', () => {
    const view = createView()
    showFourColumns(view)
    const text = view.render(140).join(NEWLINE)
    expect(text).to.include('bilibili') // 第二栏(兄弟)
    expect(text).to.include('视频A') // 第三栏(子目录)
    expect(text).to.include('1080p') // 第四栏(更深一层)
  })

  it('搜索模式 render 展示匹配结果相对路径', () => {
    const view = createView('zhongwenmulu')
    const text = view.render(140).join(NEWLINE)
    expect(text).to.include('y/中文目录')
    expect(text).to.include('共 1 条匹配')
  })

  // #endregion

  // #region 渲染宽度约束(回归: 超长目录名曾把表头行撑爆, pi-tui 检测到超宽行会直接抛错崩溃)

  describe('渲染宽度约束', () => {
    let longNameRoot: string
    let longNameIndex: DirectoryIndex

    before(() => {
      longNameRoot = mkdtempSync(join(tmpdir(), 'vptool-browser-width-'))
      // 200 字符纯 ASCII 长名, 模拟真实目录里的超长文件夹名
      const longName = 'a'.repeat(200)
      for (const dir of [longName, join(longName, 'b')]) {
        mkdirSync(join(longNameRoot, dir), {recursive: true})
      }

      longNameIndex = new DirectoryIndex(longNameRoot)
    })

    after(() => {
      rmSync(longNameRoot, {recursive: true, force: true})
    })

    it('浏览模式: 常见终端宽度下每行可见宽度都不超限', () => {
      for (const width of [209, 120, 80]) {
        const view = new DirectoryBrowserView(longNameIndex)
        view.handleKey(KEY_RIGHT) // 焦点移到第二栏, 其栏标题为长目录名
        view.handleKey(KEY_DOWN) // 高亮在长名目录与其子目录间切换, 右侧栏标题随之变化
        for (const [lineIndex, line] of view.render(width).entries()) {
          expect(visibleWidth(line), `width=${width} 第${lineIndex}行超宽`).to.be.at.most(width)
        }
      }
    })

    it('搜索模式: 长查询词与长相对路径不超宽', () => {
      const view = new DirectoryBrowserView(longNameIndex, 'a'.repeat(150))
      for (const [lineIndex, line] of view.render(80).entries()) {
        expect(visibleWidth(line), `第${lineIndex}行超宽`).to.be.at.most(80)
      }
    })
  })

  // #endregion
})