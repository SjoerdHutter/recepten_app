import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'src/generated', 'public/icons'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Scripts draaien in Node en mogen naar de console schrijven.
    files: ['scripts/**/*.{ts,mjs,js}'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off', 'no-undef': 'off' },
  },
  {
    // De proxy draait op de rand van Cloudflare of Netlify: web-API's plus
    // process.env, en geen enkele dependency.
    files: ['proxy/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.serviceworker, ...globals.node },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Het token mag nooit in een logregel belanden.
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
);
