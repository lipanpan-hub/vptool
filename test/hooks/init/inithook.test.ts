import {runHook} from '@oclif/test'
import {expect} from 'chai'

describe('hooks', () => {
  it('输出配置文件路径', async () => {
    const {stdout} = await runHook('init', {id: 'mycommand'})
    expect(stdout).to.contain('config.yml')
  })
})
