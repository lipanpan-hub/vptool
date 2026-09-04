import {includeIgnoreFile} from '@eslint/compat'
import oclif from 'eslint-config-oclif'
import prettier from 'eslint-config-prettier'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const gitignorePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.gitignore')

export default [
  includeIgnoreFile(gitignorePath),
  ...oclif,
  prettier,
  {
    rules: {
      // 排序类: 纯风格, 无功能收益
      'perfectionist/sort-classes': 'off',
      'perfectionist/sort-objects': 'off',
      'perfectionist/sort-interfaces': 'off',
      'perfectionist/sort-imports': 'off',
      'perfectionist/sort-named-imports': 'off',
      'perfectionist/sort-union-types': 'off',

      // 排版类: 与"用空行/分块提升可读性"的偏好冲突
      '@stylistic/lines-between-class-members': 'off',
      '@stylistic/padding-line-between-statements': 'off',

      // 写法偏好类: 无明显收益的强制改写
      'prefer-destructuring': 'off',
      'object-shorthand': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/no-for-loop': 'off',

      // 类型类: 本项目大量对接无类型第三方库(prompts/ytdlp/tikhub), 强制标注收益低
      '@typescript-eslint/no-explicit-any': 'off',

      // 环境类: fetch 在目标 Node 版本可用, 无需按 engines 下限报错
      'n/no-unsupported-features/node-builtins': 'off',
    },
  },
]
