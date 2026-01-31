import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import type { Linter } from 'eslint';

// Shared TypeScript rules
const sharedTypeScriptRules: Linter.RulesRecord = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/consistent-type-assertions': 'error',
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-argument': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/require-await': 'error',
  '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    {
      prefer: 'type-imports',
      fixStyle: 'inline-type-imports',
      disallowTypeAnnotations: false,
    },
  ],
  '@typescript-eslint/no-unused-vars': 'off', // handled by unused-imports
  'import/order': [
    'error',
    {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      'newlines-between': 'always',
      alphabetize: {
        order: 'asc',
        caseInsensitive: true,
      },
    },
  ],
  'unused-imports/no-unused-imports': 'error',
  'unused-imports/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  'no-control-regex': 'off',
  'no-undef': 'off', // TypeScript handles this
};

// Shared TypeScript plugins
const sharedTypeScriptPlugins = {
  '@typescript-eslint': tseslint as any,
  import: importPlugin as any,
  'unused-imports': unusedImports,
};

// Base TypeScript parser options
const baseParserOptions = {
  projectService: true,
  tsconfigRootDir: import.meta.dirname,
};

// Base JavaScript/TypeScript rules
const baseJSRules = { ...eslint.configs.recommended.rules };

// TypeScript recommended rules (without type-checking)
const tsRecommendedRules = Object.fromEntries(
  Object.entries(tseslint.configs.recommended?.rules || {}).filter(
    ([key]) => !key.includes('typescript-eslint'),
  ),
);

// TypeScript type-checking rules
const tsTypeCheckingRules = Object.fromEntries(
  Object.entries(tseslint.configs['recommended-type-checking']?.rules || {}).filter(
    ([key]) => !key.includes('typescript-eslint'),
  ),
);

// Combined base rules
const baseRules = {
  ...baseJSRules,
  ...tsRecommendedRules,
  ...tsTypeCheckingRules,
  ...prettierConfig.rules,
} as Linter.RulesRecord;

const config: Linter.Config[] = [
  // Ignore patterns
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      'public/**',
      'tests/**',
      'scripts/**',
      '*.config.js',
      '*.config.mjs',
      '*.config.ts',
      'vite.config.ts',
      'vitest.config.ts',
      'vitest.setup.ts',
      'tailwind.config.ts',
    ],
  },

  // Base configuration for all files
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
        React: 'readonly',
        NodeJS: 'readonly',
        jest: 'readonly',
      },
    },
  },

  // Client-side TypeScript/React files (including TUI)
  {
    files: ['src/client/**/*.ts', 'src/client/**/*.tsx', 'src/tui/**/*.ts', 'src/tui/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ...baseParserOptions,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      ...sharedTypeScriptPlugins,
      react: reactPlugin as any,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...baseRules,
      ...sharedTypeScriptRules,
      ...(reactPlugin.configs.recommended.rules as Linter.RulesRecord),
      ...(reactHooksPlugin.configs.recommended.rules as Linter.RulesRecord),
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // Server/CLI TypeScript files
  {
    files: ['src/cli/**/*.ts', 'src/server/**/*.ts', 'src/types/**/*.ts', 'src/utils/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: baseParserOptions,
    },
    plugins: sharedTypeScriptPlugins,
    rules: {
      ...baseRules,
      ...sharedTypeScriptRules,
    },
  },

  // Test files
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },

  // JavaScript files configuration
  {
    files: ['**/*.js', '**/*.cjs'],
    rules: {
      ...baseJSRules,
      ...prettierConfig.rules,
      'no-undef': 'error',
    },
  },
];

export default config;
