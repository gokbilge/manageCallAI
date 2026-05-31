import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Integration tests share a live PostgreSQL database and TRUNCATE in beforeEach.
    // Running files concurrently causes cross-file interference; serialize them.
    fileParallelism: false,
    hookTimeout: 30_000,
    poolOptions: {
      forks: { singleFork: true },
    },
    coverage: {
      thresholds: {
        statements: 66,
        branches: 78,
        functions: 69,
        lines: 66,
      },
    },
  },
});
