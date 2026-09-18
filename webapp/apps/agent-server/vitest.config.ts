import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@/': new URL('./src/', import.meta.url).pathname,
    },
  },
})

// Note: When run via workspace (from monorepo root), vitest uses vitest.workspace.ts.
// When run directly (npx vitest run from this dir), this config is used standalone.
