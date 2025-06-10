const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');

// Shared configuration objects
const commonGlobals = {
  // Node.js globals
  console: 'readonly',
  process: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  module: 'readonly',
  require: 'readonly',
  global: 'readonly',
  
  // Browser globals
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  crypto: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  
  // Node.js types
  NodeJS: 'readonly'
};

const jestGlobals = {
  // Jest globals
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  jest: 'readonly'
};

const commonPlugins = {
  '@typescript-eslint': typescript,
  'react': react,
  'react-hooks': reactHooks
};

const commonParserOptions = {
  ecmaVersion: 2020,
  sourceType: 'module',
  ecmaFeatures: {
    jsx: true
  }
};

const commonRules = {
  // TypeScript rules
  ...typescript.configs.recommended.rules,
  '@typescript-eslint/no-unused-vars': 'warn',
  '@typescript-eslint/no-explicit-any': 'warn',
  
  // React rules
  ...react.configs.recommended.rules,
  'react/prop-types': 'off', // TypeScript handles this
  'react/react-in-jsx-scope': 'off', // Not needed in React 17+
  'react/no-unescaped-entities': 'warn',
  'react/display-name': 'warn',
  
  // React Hooks rules
  ...reactHooks.configs.recommended.rules,
  'react-hooks/exhaustive-deps': 'warn',
  
  // General ESLint rules
  'no-useless-escape': 'warn',
  'no-control-regex': 'warn'
};

const commonSettings = {
  react: {
    version: 'detect'
  }
};

module.exports = [
  // Base JavaScript configuration
  js.configs.recommended,
  
  // Configuration for production TypeScript and React files
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/__tests__/**'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ...commonParserOptions,
        project: './tsconfig.json'
      },
      globals: {
        ...commonGlobals
        // Note: Jest globals intentionally excluded from production
      }
    },
    plugins: commonPlugins,
    rules: {
      ...commonRules,
      '@typescript-eslint/no-require-imports': 'warn' // Stricter for production
    },
    settings: commonSettings
  },
  
  // Configuration for test files
  {
    files: ['src/__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ...commonParserOptions,
        project: './tsconfig.test.json'
      },
      globals: {
        ...commonGlobals,
        ...jestGlobals
      }
    },
    plugins: commonPlugins,
    rules: {
      ...commonRules,
      '@typescript-eslint/no-require-imports': 'off' // Allow require() in tests
    },
    settings: commonSettings
  },
  
  // Ignore patterns
  {
    ignores: [
      'dist/**',
      'release/**',
      'node_modules/**',
      '*.config.js',
      '*.config.ts',
      'webpack.config.js'
    ]
  }
]; 