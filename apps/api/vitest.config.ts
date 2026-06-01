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
    // Exclude compiled dist/ so vitest 4.x does not run both src/*.test.ts and dist/*.test.js.
    include: ['src/**/*.{test,spec}.{ts,mts}'],
    exclude: ['dist/**', 'node_modules/**'],
    coverage: {
      include: ['src/**/*.{ts,mts}'],
      exclude: ['dist/**', 'node_modules/**', 'src/**/*.{test,spec}.{ts,mts}'],
      thresholds: {
        statements: 66,
        branches: 78,
        functions: 69,
        lines: 66,
      },
    },
  },
});
