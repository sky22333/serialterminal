import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.workbuddy/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react: react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...jsxA11y.configs.recommended.rules,

      // 只启用 React Hooks 的两条经典规则。
      // v7 的 recommended 还带上了 React Compiler 的一组约束（禁止 render 期读 ref 等），
      // 对虚拟滚动这种必须自己管理测量缓存的场景不适用，会逼着写更差的代码。
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // 用了新的 JSX 转换，不需要显式 import React
      'react/react-in-jsx-scope': 'off',
      // 组件契约由 TypeScript 保证，不需要运行时的 prop-types
      'react/prop-types': 'off',

      // 类型检查已经覆盖了一部分，但未使用的变量/参数仍然要清掉
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // 终端输入框必须在挂载后自动聚焦，否则用户要先点一下才能打字
      'jsx-a11y/no-autofocus': 'off',
    },
  },

  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.ts', 'vite.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      // 测试里直接操作假对象、断言后取值是常态
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
)
