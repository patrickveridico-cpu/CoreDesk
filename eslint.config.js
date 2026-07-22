const js = require('@eslint/js')
const globals = require('globals')
const reactHooks = require('eslint-plugin-react-hooks')
const reactRefresh = require('eslint-plugin-react-refresh')
const tseslint = require('typescript-eslint')

module.exports = tseslint.config(
  { ignores: ['dist', 'dist-electron', 'release', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['electron/**/*.ts', '*.config.{js,ts,cjs}', 'scripts/**/*.{js,cjs,mjs}'],
    languageOptions: { globals: { ...globals.node, fetch: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
)
