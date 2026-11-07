// Shared lint rules. These encode the architecture guardrails described in AGENTS.md —
// do not disable a rule inline without a comment explaining why.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'apps/api/drizzle/**',
      '**/*.cjs',
      '**/test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'separate-type-imports', disallowTypeAnnotations: false },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },
  // ---------------------------------------------------------------- backend
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      // NestJS DI needs runtime class imports for constructor injection.
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'Read configuration through ENV (config/env.ts), never process.env.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/modules/*/*.service', '!./**'],
              message:
                'Import other modules via their exported service from the module, not deep paths.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'apps/api/src/config/env.ts',
      'apps/api/test/**',
      'apps/api/vitest.config.ts',
      'apps/api/drizzle.config.ts',
    ],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['apps/api/src/database/seed.ts', 'apps/api/src/database/migrate.ts'],
    rules: { 'no-console': 'off' },
  },
  { files: ['apps/api/src/modules/**/*.ts'], rules: { 'no-restricted-imports': 'off' } },
  // ---------------------------------------------------------------- frontend
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'jsx-a11y/no-autofocus': 'off', // dialogs/search intentionally focus their first input
      'jsx-a11y/label-has-associated-control': ['error', { assert: 'either', depth: 3 }],
      'jsx-a11y/no-noninteractive-element-to-interactive-role': 'off',
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Use api from @/lib/api (auth, refresh and error handling).' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.name='localStorage'][property.name=/^(setItem|getItem)$/] ",
          message:
            'Do not store data/tokens in localStorage (only UI preferences in lib/i18n & theme).',
        },
        {
          selector:
            'Literal[value=/\\b(bg|text|border)-(red|blue|green|yellow|gray|slate|zinc|neutral|teal|amber|emerald|sky)-[0-9]{2,3}\\b/]',
          message:
            'Use semantic design tokens (bg-primary, text-muted-foreground…), not raw palette colours.',
        },
        {
          selector: 'Literal[value=/\\b(ml|mr|pl|pr|left|right)-[0-9]/]',
          message: 'Use logical properties (ms-/me-/ps-/pe-/start-/end-) so layouts mirror in RTL.',
        },
        {
          selector:
            "JSXAttribute[name.name='style'] Property[key.name=/^(color|background|backgroundColor)$/]",
          message: 'Use design tokens instead of inline colours.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'axios', message: 'Use @/lib/api.' }],
          patterns: [
            {
              group: ['@radix-ui/*'],
              message:
                'Import Radix only inside components/ui; use the wrapped components elsewhere.',
            },
          ],
        },
      ],
    },
  },
  { files: ['apps/web/src/components/ui/**'], rules: { 'no-restricted-imports': 'off' } },
  // Modal centring uses physical left-1/2 + translate, which is direction-neutral.
  { files: ['apps/web/src/components/ui/dialog.tsx'], rules: { 'no-restricted-syntax': 'off' } },
  // File-name sanitiser deliberately matches control characters.
  {
    files: ['apps/api/src/modules/files/file-validation.ts'],
    rules: { 'no-control-regex': 'off' },
  },
  { files: ['apps/web/src/lib/api.ts'], rules: { 'no-restricted-globals': 'off' } },
  {
    files: ['apps/web/src/lib/i18n.ts', 'apps/web/src/app/AppShell.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  { files: ['apps/web/src/features/design-system/**'], rules: { 'no-restricted-syntax': 'off' } },
  {
    files: ['apps/web/e2e/**', 'apps/web/playwright.config.ts', 'apps/web/vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  { files: ['apps/web/public/**/*.js'], languageOptions: { globals: globals.browser } },
  prettier,
);
