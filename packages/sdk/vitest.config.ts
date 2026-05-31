import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      thresholds: {
        statements: 99,
        branches: 92,
        functions: 100,
        lines: 99,
      },
    },
  },
});
