import { beforeAll, afterAll, vi } from 'vitest'

// Mock environment variables for tests
beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-key-minimum-32-characters-long-for-jwt'
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
  process.env.NODE_ENV = 'test'
})

afterAll(() => {
  // Cleanup if needed
})

// Mock Prisma client by default (can be overridden per test)
vi.mock('@droiduse/shared-prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    knowledge: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    app: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    device: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))
