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
          name: 'protocol',
          root: './src/protocol',
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
      {
        test: {
          name: 'server',
          root: './src/server',
          include: ['test/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
