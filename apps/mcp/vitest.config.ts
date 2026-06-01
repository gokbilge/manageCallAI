import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,mts}'],
    exclude: ['dist/**', 'node_modules/**'],
    coverage: {
      include: ['src/**/*.{ts,mts}'],
      exclude: ['dist/**', 'node_modules/**', 'src/**/*.{test,spec}.{ts,mts}'],
      thresholds: {
        statements: 83,
        branches: 79,
        functions: 95,
        lines: 83,
      },
    },
  },
});
