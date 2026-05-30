import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.integration.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['src/**/*.integration.test.ts'],
          environment: 'node',
          // Integration tests share a live PostgreSQL database and TRUNCATE in
          // beforeEach. Parallel execution causes cross-file interference.
          fileParallelism: false,
          hookTimeout: 30_000,
          poolOptions: {
            forks: { singleFork: true },
          },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.integration.test.ts',
        'src/**/*.d.ts',
      ],
      // No global thresholds: most production code is covered by integration
      // tests (which run against the live DB in the Tests CI step) rather than
      // unit tests. Thresholds should be set per-file once the integration
      // coverage reporter is connected.
    },
  },
});
