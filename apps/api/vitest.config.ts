import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Integration tests share a live PostgreSQL database and TRUNCATE in beforeEach.
    // Running files concurrently causes cross-file interference; serialize them.
    fileParallelism: false,
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
