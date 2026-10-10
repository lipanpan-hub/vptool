// 自测 vp dl --best 的自动字幕: en-orig 优先、缺失回退 en, 字幕与视频同目录同名落盘
import assert from 'node:assert/strict'
import {mkdirSync, readdirSync, rmSync} from 'node:fs'
import {join} from 'node:path'

import {downloadVideo} from '../dist/lib/dl/download-video.js'
import {fetchVideoInfo} from '../dist/lib/dl/fetch-video-info.js'
import {resolveAutoEnglishSubtitleLang} from '../dist/lib/dl/select-subtitle.js'

// #region 纯逻辑断言
// 每项为 [自动字幕表, 期望语言]
const logicCases = [
  [{'en-orig': [{}], en: [{}]}, 'en-orig'],
  [{en: [{}]}, 'en'],
  [{ja: [{}]}, undefined],
  [{}, undefined],
]
for (const [autoCaptions, expected] of logicCases) {
  const resolved = resolveAutoEnglishSubtitleLang({automatic_captions: autoCaptions})
  assert.equal(resolved, expected, `语言优先级解析错误: ${JSON.stringify(autoCaptions)}`)
}
console.log('✓ 语言优先级逻辑通过')
// #endregion

// #region 真实下载断言(WG7x4kG9pFI 存在 en-orig 自动字幕)
const url = 'https://www.youtube.com/watch?v=WG7x4kG9pFI'
const workDir = join(process.cwd(), 'testmp', 'tmp-dl-auto-sub')
rmSync(workDir, {force: true, recursive: true})
mkdirSync(workDir, {recursive: true})

const videoInfo = await fetchVideoInfo(url, false)
const autoSubtitleLang = resolveAutoEnglishSubtitleLang(videoInfo)
assert.equal(autoSubtitleLang, 'en-orig', `预期 en-orig, 实际 ${autoSubtitleLang}`)

await downloadVideo(url, {
  autoSubtitleLang,
  extractAudio: false,
  // 纯 DASH 视频没有单文件格式, worst 会匹配不到, 用分流合并的最小档(贴近 --best 的合并流程)
  formatId: 'worstvideo+worstaudio/worst',
  outputDir: workDir,
  useCookies: false,
}, {log: (message) => console.log('  [log]', message)})

// 字幕应与视频文件同目录同名落盘; .output() 的目录语义会多套一层 "<标题>.<扩展名>" 文件夹, 视频与字幕都在其中
const domainDir = join(workDir, 'youtube.com')
const [videoFolderName] = readdirSync(domainDir)
const videoDir = join(domainDir, videoFolderName)
const files = readdirSync(videoDir)
const subtitleName = `${videoInfo.title}.${autoSubtitleLang}.vtt`
assert.ok(files.includes(subtitleName), `未找到字幕 ${subtitleName}, 实际: ${files.join(', ')}`)
console.log('✓ 字幕落盘通过:', join(videoDir, subtitleName))
// #endregion

rmSync(workDir, {force: true, recursive: true})
console.log('全部通过')
