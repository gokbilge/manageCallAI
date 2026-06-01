import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx,mts}'],
    exclude: ['dist/**', 'node_modules/**'],
    coverage: {
      // Thresholds re-calibrated after vitest 3→4 upgrade (same branch-counting change as API).
      thresholds: {
        statements: 67,
        branches: 65,
        functions: 63,
        lines: 68,
      },
    },
  },
});
