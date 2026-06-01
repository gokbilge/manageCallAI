import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,mts}'],
    exclude: ['dist/**', 'node_modules/**'],
    coverage: {
      // Thresholds re-calibrated after vitest 3→4 upgrade.
      thresholds: {
        statements: 78,
        branches: 67,
        functions: 95,
        lines: 78,
      },
    },
  },
});
