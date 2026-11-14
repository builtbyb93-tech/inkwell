import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { 'server-only': new URL('./tests/support/server-only.ts', import.meta.url).pathname },
  },
  test: {
    projects: [
      { test: { name: 'unit', environment: 'node', include: ['tests/unit/**/*.test.ts'] } },
      {
        test: {
          name: 'integration',
          testTimeout: 20000,
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'backup',
          testTimeout: 60000,
          environment: 'node',
          include: ['tests/integration/backup.test.mjs'],
          fileParallelism: false,
        },
      },
    ],
  },
});
