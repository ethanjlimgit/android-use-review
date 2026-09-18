import { defineConfig } from 'vitest/config'
import path from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node', // Change to 'jsdom' for component tests
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        '.next/**',
        '**/*.config.{ts,js}',
        'app/layout.tsx',
        'app/**/layout.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@droiduse/shared-lib': path.resolve(__dirname, '../../packages/shared-lib'),
      '@droiduse/shared-prisma': path.resolve(__dirname, '../../packages/shared-prisma'),
      '@droiduse/shared-ui': path.resolve(__dirname, '../../packages/shared-ui'),
    },
  },
})
