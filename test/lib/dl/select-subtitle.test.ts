import {expect} from 'chai'
import type {VideoInfo} from 'ytdlp-nodejs'

import {resolveAutoEnglishSubtitleLang} from '../../../src/lib/dl/select-subtitle.js'

// 用最小结构模拟 VideoInfo, 只保留字幕相关字段
function buildVideoInfo(automaticCaptions: Record<string, unknown>): VideoInfo {
  return {automatic_captions: automaticCaptions} as unknown as VideoInfo
}

describe('resolveAutoEnglishSubtitleLang', () => {
  it('en-orig 与 en 同时存在时优先 en-orig', () => {
    const videoInfo = buildVideoInfo({'en-orig': [{}], en: [{}]})
    expect(resolveAutoEnglishSubtitleLang(videoInfo)).to.equal('en-orig')
  })

  it('缺失 en-orig 时回退 en', () => {
    const videoInfo = buildVideoInfo({en: [{}]})
    expect(resolveAutoEnglishSubtitleLang(videoInfo)).to.equal('en')
  })

  it('只有其他语言时返回 undefined', () => {
    const videoInfo = buildVideoInfo({ja: [{}], 'zh-Hans': [{}]})
    expect(resolveAutoEnglishSubtitleLang(videoInfo)).to.equal(undefined)
  })

  it('没有自动字幕时返回 undefined', () => {
    const videoInfo = buildVideoInfo({})
    expect(resolveAutoEnglishSubtitleLang(videoInfo)).to.equal(undefined)
  })
})
