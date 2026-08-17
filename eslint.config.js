import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, __APP_VERSION__: 'readonly' },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      /*
       * The compiler-aware hook rules ship as errors. Two of them fire on
       * patterns this app uses deliberately, so they are demoted to warnings
       * rather than worked around:
       *
       * - set-state-in-effect: every hit is an external-system sync the rule
       *   cannot see through — measuring `visualViewport`, seeding a Dexie
       *   subscription, or re-arming a sheet's form when it reopens.
       * - preserve-manual-memoization: bails on components that early-return
       *   after their hooks; the memo is still correct, just not compiler-owned.
       *
       * They stay on as warnings so a genuinely careless case is still visible.
       */
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',

      // Import order, grouped: node/react → packages → app aliases → relative.
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // Side-effect imports first and untouched — polyfills have to run
            // before the modules that depend on them are evaluated.
            ['^\\u0000'],
            ['^node:', '^react', '^@?\\w'],
            ['^#types$', '^#(components|views|hooks|lib|store|root|utils)(/.*)?$'],
            ['^\\.\\.(?!/?$)', '^\\.\\./?$', '^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
            ['^.+\\.css$'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // The scaffolded Firebase adapter is deliberately full of unused params.
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
  {
    // Test files run in Node with vitest globals imported explicitly.
    files: ['tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
)
