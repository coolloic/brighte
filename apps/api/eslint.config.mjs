import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'eslint.config.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  // Import another module through its barrel (`../auth/index.js`), never its files. Nest
  // `*.module.js` classes are the exception: barrels leave them out to avoid import cycles.
  // Inside a module, import siblings directly: a file importing its own barrel creates a cycle.
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    // Run uncompiled by Node type stripping, which cannot load barrels: their `.js` paths do not
    // exist before a build, and strip-only mode rejects enums (Role).
    ignores: ['src/database/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(\\./)?(\\.\\./)+(src/)?(?!src/)[\\w-]+/(?!index\\.js$)(?![\\w.-]+\\.module\\.js$).+',
              message: "Import another module through its barrel, e.g. '../auth/index.js'.",
            },
            {
              regex: '^(\\./|(\\.\\./)+)index\\.js$',
              message: 'Import sibling files directly: importing your own barrel creates a cycle.',
            },
          ],
        },
      ],
    },
  },
  // Black-box smoke test: reads untyped JSON responses, as any HTTP client would.
  {
    files: ['test/smoke/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    files: ['src/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\./[\\w-]+/(?!index\\.js$)(?![\\w.-]+\\.module\\.js$).+',
              message: "Import a module through its barrel, e.g. './common/index.js'.",
            },
          ],
        },
      ],
    },
  },
);
