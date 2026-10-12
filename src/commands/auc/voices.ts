import {Flags} from '@oclif/core'

import {BaseCommand} from '../../lib/base-command.js'
import {AudioCppClient} from '../../lib/auc/audiocpp-client.js'
import {ToolConfigManager} from '../../lib/config/index.js'

export default class AucVoices extends BaseCommand {
  static description = '列出 audiocpp_server 共享参考音色库中的音色'

  static examples = ['<%= config.bin %> <%= command.id %>']

  static flags = {
    model: Flags.string({description: 'TTS 模型 id', default: 'index_tts2'}),
    port: Flags.integer({description: '服务监听端口(需与启动时一致)', default: 8080}),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(AucVoices)

    const audioCppDir = ToolConfigManager.fromConfigDir(this.config.configDir).getAudioCppDir()
    if (audioCppDir === null) {
      this.error('未配置 audiocpp 目录, 请先执行: vp auc cfset <audiocpp目录>')
    }

    const client = new AudioCppClient({baseUrl: `http://127.0.0.1:${flags.port}`})
    const voices = await client.listVoices(flags.model)

    if (voices.length === 0) {
      this.log(`模型 ${flags.model} 没有可用音色`)
      return
    }
    for (const voiceName of voices) {
      this.log(voiceName)
    }
  }
}
