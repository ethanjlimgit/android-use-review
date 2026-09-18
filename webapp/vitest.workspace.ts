import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // Shared library tests (unit tests, no DOM)
  {
    extends: './packages/shared-lib/vitest.config.ts',
    test: {
      name: 'shared-lib',
      include: ['packages/shared-lib/**/*.{test,spec}.{ts,tsx}'],
      environment: 'node',
    },
  },
  // Shared UI tests (component tests with DOM)
  {
    extends: './packages/shared-ui/vitest.config.ts',
    test: {
      name: 'shared-ui',
      include: ['packages/shared-ui/**/*.{test,spec}.{ts,tsx}'],
      environment: 'jsdom',
    },
  },
  // Frontend app tests
  {
    extends: './apps/frontend/vitest.config.ts',
    test: {
      name: 'frontend',
      include: ['apps/frontend/**/*.{test,spec}.{ts,tsx}'],
      environment: 'node', // Use 'jsdom' if testing React components
    },
  },
  // Agent server tests
  {
    extends: './apps/agent-server/vitest.config.ts',
    test: {
      name: 'agent-server',
      include: ['apps/agent-server/tests/**/*.{test,spec}.{ts,tsx}'],
      environment: 'node',
    },
  },
])
