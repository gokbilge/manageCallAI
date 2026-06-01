import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,mts}'],
    exclude: ['dist/**', 'node_modules/**'],
    coverage: {
      // Thresholds re-calibrated after vitest 3→4 upgrade.
      thresholds: {
        statements: 99,
        branches: 85,
        functions: 100,
        lines: 99,
      },
    },
  },
});
