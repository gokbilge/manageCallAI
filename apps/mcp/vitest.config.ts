import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      thresholds: {
        statements: 83,
        branches: 79,
        functions: 95,
        lines: 83,
      },
    },
  },
});
