import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,mts}'],
    exclude: ['dist/**', 'node_modules/**'],
  },
});
