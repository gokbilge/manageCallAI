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
      // Vitest 4 / @vitest/coverage-v8 counts TypeScript optional/nullish
      // branches exhaustively. Statement, function, and line gates now enforce
      // the API 80% target; branch coverage stays at the evidenced level until
      // runtime-only FreeSWITCH/SIP branches have live coverage.
      thresholds: {
        statements: 80,
        branches: 68,
        functions: 80,
        lines: 80,
      },
    },
  },
});
