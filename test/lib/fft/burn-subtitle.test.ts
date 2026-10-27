import {expect} from 'chai'

import {buildForceStyle} from '../../../src/lib/fft/burn-subtitle.js'

describe('buildForceStyle', () => {
  it('wrapStyle 映射为 force_style 的 WrapStyle 字段', () => {
    expect(buildForceStyle({wrapStyle: 2})).to.equal('WrapStyle=2')
  })

  it('wrapStyle 与其他样式字段共存时按逗号拼接', () => {
    const forceStyle = buildForceStyle({fontSize: 8, marginV: 5, wrapStyle: 2})
    expect(forceStyle).to.equal('FontSize=8,MarginV=5,WrapStyle=2')
  })

  it('未提供 wrapStyle 时不输出 WrapStyle 字段', () => {
    expect(buildForceStyle({fontSize: 8})).to.equal('FontSize=8')
  })
})
