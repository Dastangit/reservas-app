const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/', 'coverage/', 'backups/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      // Los logs van a stdout (Render): se permite info/warn/error; console.log
      // suelto queda como aviso por si es un resto de depuracion.
      'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Scripts de consola, arranque y tests: imprimir es su trabajo.
    files: ['scripts/**', 'server.js', 'worker.js', 'instrument.js', 'config/**', 'tests/**'],
    rules: { 'no-console': 'off' },
  },
];
