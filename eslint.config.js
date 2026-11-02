/**
 * FILE: eslint.config.js
 * PURPOSE: Repo-wide ESLint flat config (TypeScript + React hooks rules).
 * LAYER: Config
 * NOTES: react-hooks rules apply only to the web app; Node globals only to api/config files.
 */
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      'node_modules/**',
      'internalDocs/**',
      'backend/src/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      'backend/**/*.ts',
      'packages/**/*.ts',
      '*.js',
      'scripts/**/*.mjs',
      '**/vite.config.ts',
      '**/vitest.config.ts',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['frontend/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
