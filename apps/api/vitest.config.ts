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
      //
      // Beta exception (issue #141): API is below the ≥80% beta target due to
      // the large surface area of integration-only modules (FreeSWITCH XML,
      // SIP/ESL edge paths, streaming observability) that require a live runtime
      // to cover meaningfully. Target: reach 70% before beta GA; 80% before RC.
      //
      // Raised 2026-06-02 after adding unit tests for sip-trunk, phone-number,
      // schedule (update path), voicemail-box, retention, and platform services
      // (CI run 26834489441: statements 67.46%, branches 56.09%, lines 67.46%).
      thresholds: {
        statements: 67,
        branches: 56,
        functions: 66,
        lines: 67,
      },
    },
  },
});
