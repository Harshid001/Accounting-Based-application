import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  test: {
    environment: 'node',
    // We are running against a real local Postgres DB.
    // We disable threads/parallel execution so tests don't step on each other's DB transactions.
    pool: 'forks',
    fileParallelism: false,
    setupFiles: ['./tests/setup.ts'],
  },
})
