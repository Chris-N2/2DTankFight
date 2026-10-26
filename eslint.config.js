import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['*.config.{js,ts}', 'src/client/vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/client/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    // The simulation must be pure: no wall-clock time, timers or unseeded randomness.
    // (DOM access is already prevented by src/sim/tsconfig.json having no DOM lib.)
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'The simulation must not read wall-clock time. Use the tick counter.' },
        {
          name: 'performance',
          message: 'The simulation must not read wall-clock time. Use the tick counter.',
        },
        { name: 'setTimeout', message: 'The simulation must not use timers. Count ticks instead.' },
        { name: 'setInterval', message: 'The simulation must not use timers. Count ticks instead.' },
        { name: 'requestAnimationFrame', message: 'Rendering loops belong in the client.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded RNG (rng.ts) so runs are reproducible.',
        },
      ],
    },
  },
);
