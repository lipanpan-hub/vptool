import {Hook} from '@oclif/core'
import {ToolConfigManager} from '../../lib/config/index.js'
import {checkFirefoxInstalled} from '../../lib/hooks/check-firefox.js'

const hook: Hook<'init'> = async function (options) {

  // #region 配置文件初始化
  // 确保 configDir 下存在 config.yml,不存在则创建含默认档案的配置文件
  const configManager = ToolConfigManager.fromConfigDir(options.config.configDir)
  this.log(configManager.getConfigPath())
  if (configManager.ensureConfig()) {
    this.log(`已创建默认配置文件: ${configManager.getConfigPath()}`)
  }
  // #endregion
  
  // #region 浏览器检测
  // 检测火狐浏览器
  if (!checkFirefoxInstalled()) {
    process.stderr.write('\n⚠️  警告: 未检测到火狐浏览器,部分功能可能无法使用\n')
    process.stderr.write('   请访问 https://www.mozilla.org/firefox/ 下载安装\n\n')
  }
  // #endregion

}

export default hook
