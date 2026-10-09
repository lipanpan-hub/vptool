// 自测 fft add-audio 的新命名策略: 源视频 -> video.old.mp4, 合并结果占用 video.mp4
import {spawnSync} from 'node:child_process'
import {existsSync, mkdirSync, rmSync} from 'node:fs'
import {join} from 'node:path'
import {helpers} from 'ytdlp-nodejs'

import {addAudioToVideo, buildBackupPath} from '../dist/lib/fft/add-audio.js'

const workDir = join(process.cwd(), 'testmp', 'tmp-add-audio')
rmSync(workDir, {force: true, recursive: true})
mkdirSync(workDir, {recursive: true})

const ffmpegPath = helpers.findFFmpegBinary()
const videoPath = join(workDir, 'video.mp4')
const audioPath = join(workDir, 'bgm.mp3')

function run(args) {
  const result = spawnSync(ffmpegPath, args, {encoding: 'utf8'})
  if ((result.status !== 0)) throw new Error(`ffmpeg 执行失败: ${result.stderr}`)
}

// 统计文件中的音轨/视频轨数量
function countStreams(filePath, kind) {
  const result = spawnSync(ffmpegPath, ['-i', filePath], {encoding: 'utf8'})
  const matches = (result.stderr.match(new RegExp(`Stream #\\S+.*: ${kind}:`, 'g')) ?? [])
  return matches.length
}

// 构造 1 秒含原声的测试视频 与 1 秒独立音轨
run(['-y', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=15:duration=1', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', videoPath])
run(['-y', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=1', '-c:a', 'libmp3lame', audioPath])

const backupPath = buildBackupPath(videoPath)
console.log('预期备份路径:', backupPath)

const outputPath = await addAudioToVideo(videoPath, audioPath, {log: (message) => console.log('  [log]', message)})

// 断言
const checks = [
  ['返回路径等于原文件名', outputPath === videoPath],
  ['源视频已备份为 .old', existsSync(backupPath)],
  ['合并结果占用原文件名', existsSync(videoPath)],
  ['合并结果不存在 merged 文件', !existsSync(videoPath.replace(/(\.[^.]+)$/, '.merged$1'))],
  ['合并结果含 2 条音轨', countStreams(videoPath, 'Audio') === 2],
  ['合并结果含 1 条视频轨', countStreams(videoPath, 'Video') === 1],
  ['备份文件含 1 条音轨', countStreams(backupPath, 'Audio') === 1],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`)
  if (!ok) failed += 1
}

console.log(failed === 0 ? '\n全部通过' : `\n失败 ${failed} 项`)
process.exit(failed === 0 ? 0 : 1)