import {expect} from 'chai'
import type {VideoInfo} from 'ytdlp-nodejs'

import {resolveAutoEnglishSubtitleLang, resolveAutoSubtitleLangs, resolveSubtitlePlan} from '../../../src/lib/dl/select-subtitle.js'

// 用最小结构模拟 VideoInfo, 只保留字幕相关字段
function buildVideoInfo(automaticCaptions: Record<string, unknown>): VideoInfo {
  return {automatic_captions: automaticCaptions} as unknown as VideoInfo
}

describe('select-subtitle', () => {
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

  describe('resolveAutoSubtitleLangs', () => {
    it('英文与 zh-Hans 都存在时同时返回, 英文在前', () => {
      const videoInfo = buildVideoInfo({'en-orig': [{}], en: [{}], 'zh-Hans': [{}], 'zh-Hans-en': [{}]})
      expect(resolveAutoSubtitleLangs(videoInfo)).to.deep.equal(['en-orig', 'zh-Hans'])
    })

    it('缺失 zh-Hans 时只返回英文', () => {
      const videoInfo = buildVideoInfo({en: [{}], 'zh-Hant': [{}]})
      expect(resolveAutoSubtitleLangs(videoInfo)).to.deep.equal(['en'])
    })

    it('缺失英文时只返回 zh-Hans', () => {
      const videoInfo = buildVideoInfo({ja: [{}], 'zh-Hans': [{}]})
      expect(resolveAutoSubtitleLangs(videoInfo)).to.deep.equal(['zh-Hans'])
    })

    it('没有自动字幕时返回空数组', () => {
      expect(resolveAutoSubtitleLangs(buildVideoInfo({}))).to.deep.equal([])
    })
  })

  describe('resolveSubtitlePlan', () => {
    it('YouTube 走自动字幕: 英文 + zh-Hans', () => {
      const videoInfo = {automatic_captions: {en: [{}], 'zh-Hans': [{}]}, extractor_key: 'Youtube'} as unknown as VideoInfo
      expect(resolveSubtitlePlan(videoInfo)).to.deep.equal({autoLangs: ['en', 'zh-Hans'], manualLangs: []})
    })

    it('B 站走人工字幕 ai-zh, 不依赖 -J 中的 subtitles', () => {
      const videoInfo = {extractor_key: 'BiliBili', subtitles: {}} as unknown as VideoInfo
      expect(resolveSubtitlePlan(videoInfo)).to.deep.equal({autoLangs: [], manualLangs: ['ai-zh']})
    })

    it('未配置的站点不附带字幕', () => {
      const videoInfo = {extractor_key: 'Vimeo'} as unknown as VideoInfo
      expect(resolveSubtitlePlan(videoInfo)).to.deep.equal({autoLangs: [], manualLangs: []})
    })
  })
})
