import { beforeAll, afterAll, afterEach, vi } from 'vitest'
import { server } from './mocks/server'

// Environment variables
beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-key-minimum-32-characters-long-for-jwt'
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
  // NODE_ENV is automatically set to 'test' by vitest

  // Start MSW server
  server.listen({ onUnhandledRequest: 'warn' })
})

afterAll(() => {
  server.close()
})

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers()
})

// Mock Next.js modules
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  redirect: vi.fn(),
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    NextResponse: {
      json: (data: any, init?: ResponseInit) => new Response(JSON.stringify(data), {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...init?.headers,
        },
      }),
    },
    NextRequest: actual.NextRequest,
  }
})

// Mock NextAuth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => Promise.resolve(null)),
}))

// Mock Prisma and storage from shared-lib
vi.mock('@droiduse/shared-lib/server', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    skill: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    app: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    device: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    task: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    interaction: { findMany: vi.fn(), create: vi.fn() },
  },
  storage: {
    getSkills: vi.fn(),
    createSkill: vi.fn(),
    searchSkillsWithEmbeddings: vi.fn(),
    getDevices: vi.fn(),
    registerDevice: vi.fn(),
    getTasks: vi.fn(),
    createTask: vi.fn(),
  },
  verifyMobileToken: vi.fn(),
  extractBearerToken: vi.fn(),
}))
