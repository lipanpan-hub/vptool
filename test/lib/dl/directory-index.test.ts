import {expect} from 'chai'
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {DirectoryIndex} from '../../../src/lib/dl/directory-index.js'

// fixture 目录树:
// root/
//   x/youtube/{视频A,视频B}  x/bilibili/{视频A(与 youtube 下重名), .git(隐藏, 应被排除)}
//   x/{01coder(搜索目标), 2021 code(与 01coder 搜索无关的纯噪声名)}
//   y/{中文目录, 单独目录, .vttflow(隐藏, 应被排除)}
describe('DirectoryIndex', () => {
  let rootPath: string
  let index: DirectoryIndex

  before(() => {
    rootPath = mkdtempSync(join(tmpdir(), 'vptool-index-'))
    for (const dir of ['x/youtube/视频A', 'x/youtube/视频B', 'x/bilibili/视频A', 'x/bilibili/.git', 'x/01coder', 'x/2021 code', 'y/中文目录', 'y/单独目录', 'y/.vttflow']) {
      mkdirSync(join(rootPath, dir), {recursive: true})
    }

    // 根下放一个文件, 验证索引只收集目录
    writeFileSync(join(rootPath, 'readme.txt'), 'x')
    index = new DirectoryIndex(rootPath)
  })

  after(() => {
    rmSync(rootPath, {recursive: true, force: true})
  })

  // #region 树结构查询

  it('只收集目录, 文件不进入索引', () => {
    // 1 个根 + 11 个目录(含中间目录), 根下的 readme.txt 与各隐藏目录不计入
    expect(index.totalCount).to.equal(12)
  })

  it('隐藏目录(. 开头)不进入索引', () => {
    expect(index.nodeAt(join(rootPath, 'x', 'bilibili', '.git'))).to.equal(undefined)
    expect(index.nodeAt(join(rootPath, 'y', '.vttflow'))).to.equal(undefined)
    expect(index.search('vttflow')).to.deep.equal([])
  })

  it('childrenOf 返回子目录且不含文件', () => {
    const childNames = index.childrenOf(rootPath).map((n) => n.name)
    expect(childNames).to.deep.equal(['x', 'y'])
  })

  it('parentOf 与 nodeAt 正确反映父子关系', () => {
    const youtube = index.nodeAt(join(rootPath, 'x', 'youtube'))!
    expect(youtube).to.not.equal(undefined)
    expect(index.parentOf(youtube.fullPath)!.fullPath).to.equal(join(rootPath, 'x'))
    expect(youtube.relPath).to.equal('x/youtube')
    expect(index.parentOf(rootPath)).to.equal(undefined)
  })

  // #endregion

  // #region 全树模糊搜索

  it('中文名搜索命中', () => {
    const hits = index.search('中文目录')
    expect(hits.map((n) => n.relPath)).to.include('y/中文目录')
  })

  it('全拼搜索命中', () => {
    const hits = index.search('zhongwenmulu')
    expect(hits.map((n) => n.relPath)).to.include('y/中文目录')
  })

  it('首字母搜索命中', () => {
    const hits = index.search('zwml')
    expect(hits.map((n) => n.relPath)).to.include('y/中文目录')
  })

  it('空查询返回空数组', () => {
    expect(index.search('')).to.deep.equal([])
    expect(index.search('   ')).to.deep.equal([])
  })

  it('英文名搜索: 目标排最前, 纯噪声不入选(回归: 搜 01coder 曾混入 2021 code 等无关条目)', () => {
    const hitNames = index.search('01coder').map((n) => n.name)
    expect(hitNames[0]).to.equal('01coder')
    expect(hitNames).to.not.include('2021 code')
  })

  // #endregion

  // #region 参数直达

  it('精确相对路径命中直达', () => {
    const match = index.findUniqueMatch('x/youtube')
    expect(match!.relPath).to.equal('x/youtube')
  })

  it('唯一同名目录直达', () => {
    const match = index.findUniqueMatch('单独目录')
    expect(match!.relPath).to.equal('y/单独目录')
  })

  it('重名目录不直达, 交给交互式消歧', () => {
    expect(index.findUniqueMatch('视频A')).to.equal(undefined)
  })

  it('模糊唯一命中直达', () => {
    const match = index.findUniqueMatch('zhongwen')
    expect(match!.relPath).to.equal('y/中文目录')
  })

  // #endregion
})
