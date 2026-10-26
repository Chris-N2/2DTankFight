import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'sim',
          root: './src/sim',
          include: ['test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'client',
          root: './src/client',
          include: ['test/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
