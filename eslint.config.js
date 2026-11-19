const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  { ignores: ['foodbuddy-temp/**', 'node_modules/**', '.expo/**', 'dist/**', 'coverage/**'] },
  expo,
  {
    // Async loading effects are valid here. Keep the compiler's performance
    // advice visible without requiring an unrelated component rewrite.
    files: ['App.tsx', 'screens/NearbyStoresScreen.tsx', 'screens/ProductSearchScreen.tsx', 'components/ProductDemoAvailability.tsx', 'components/AllergyCard.tsx'],
    rules: { 'react-hooks/set-state-in-effect': 'warn' },
  },
  {
    files: ['**/*.cjs', 'backend/**/*.js', '*.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { __dirname: 'readonly', __filename: 'readonly', Buffer: 'readonly', process: 'readonly', module: 'readonly', require: 'readonly', exports: 'readonly', global: 'readonly' },
    },
  },
  {
    // Teammate-owned derivative screens remain byte-for-byte unchanged.
    // Report existing JSX punctuation style as advice, not an application error.
    files: ['components/AllergyCard.tsx', 'screens/AllergyProfileScreen.tsx'],
    rules: { 'react/no-unescaped-entities': 'warn' },
  },
]);
