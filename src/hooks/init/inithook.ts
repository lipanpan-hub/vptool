import {Hook} from '@oclif/core'

import {ensureConfigFile} from '../../lib/config/ensure-config.js'
import {checkFirefoxInstalled} from '../../lib/hooks/check-firefox.js'

const hook: Hook<'init'> = async function (options) {

  // #region 配置文件初始化
  ensureConfigFile(options.config.configDir)
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
