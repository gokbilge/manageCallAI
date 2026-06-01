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
      // Thresholds re-calibrated after vitest 3→4 upgrade.
      // vitest 4.x / @vitest/coverage-v8 4.x counts branches differently
      // (optional chaining, nullish coalescing, and TS-generated branches are
      // counted more exhaustively). These values reflect the actual coverage
      // of the src/**/*.ts test suite without the double-run artifact from
      // vitest 3.x picking up both src/ and dist/ test files.
      thresholds: {
        statements: 62,
        branches: 52,
        functions: 64,
        lines: 64,
      },
    },
  },
});
