import { describe, it, expect, beforeEach, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { authorizeCredentials } from './credentials-validator'

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}))

describe('authorizeCredentials', () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'test'
  })

  it('should return null for invalid credentials format', async () => {
    const result = await authorizeCredentials(
      { email: 'not-an-email', password: '123' },
      { prisma: mockPrisma }
    )

    expect(result).toBeNull()
  })

  it('should return null for missing email', async () => {
    const result = await authorizeCredentials(
      { password: 'password123' },
      { prisma: mockPrisma }
    )

    expect(result).toBeNull()
  })

  it('should return null for missing password', async () => {
    const result = await authorizeCredentials(
      { email: 'test@example.com' },
      { prisma: mockPrisma }
    )

    expect(result).toBeNull()
  })

  it('should return null for password shorter than 6 characters', async () => {
    const result = await authorizeCredentials(
      { email: 'test@example.com', password: '12345' },
      { prisma: mockPrisma }
    )

    expect(result).toBeNull()
  })

  it('should return null if user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const result = await authorizeCredentials(
      { email: 'test@example.com', password: 'password123' },
      { prisma: mockPrisma }
    )

    expect(result).toBeNull()
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
    })
  })

  it('should return null if user has no password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user123',
      email: 'test@example.com',
      name: 'Test User',
      password: null,
      emailVerified: new Date(),
      role: 'user',
      banned: false,
    })

    const result = await authorizeCredentials(
      { email: 'test@example.com', password: 'password123' },
      { prisma: mockPrisma }
    )

    expect(result).toBeNull()
  })

  it('should return null if user is banned', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user123',
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedpassword',
      emailVerified: new Date(),
      role: 'user',
      banned: true,
    })

    const result = await authorizeCredentials(
      { email: 'test@example.com', password: 'password123' },
      { prisma: mockPrisma }
    )

    expect(result).toBeNull()
  })

  it('should return null if email not verified', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user123',
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedpassword',
      emailVerified: null,
      role: 'user',
      banned: false,
    })

    const result = await authorizeCredentials(
      { email: 'test@example.com', password: 'password123' },
      { prisma: mockPrisma }
    )

    expect(result).toBeNull()
  })

  it('should return null if password is incorrect', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user123',
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedpassword',
      emailVerified: new Date(),
      role: 'user',
      banned: false,
    })

    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

    const result = await authorizeCredentials(
      { email: 'test@example.com', password: 'wrongpassword' },
      { prisma: mockPrisma }
    )

    expect(result).toBeNull()
  })

  it('should return user data for valid credentials', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user123',
      email: 'test@example.com',
      name: 'Test User',
      image: 'https://example.com/avatar.jpg',
      password: 'hashedpassword',
      emailVerified: new Date(),
      role: 'user',
      banned: false,
    })

    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const result = await authorizeCredentials(
      { email: 'test@example.com', password: 'password123' },
      { prisma: mockPrisma }
    )

    expect(result).toEqual({
      id: 'user123',
      email: 'test@example.com',
      name: 'Test User',
      image: 'https://example.com/avatar.jpg',
      role: 'user',
    })
  })

  it('should return null when non-admin tries to access admin-only', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user123',
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedpassword',
      emailVerified: new Date(),
      role: 'user',
      banned: false,
    })

    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const result = await authorizeCredentials(
      { email: 'test@example.com', password: 'password123' },
      { prisma: mockPrisma, requireAdmin: true }
    )

    expect(result).toBeNull()
  })

  it('should allow admin login when requireAdmin is true', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'admin123',
      email: 'admin@example.com',
      name: 'Admin User',
      password: 'hashedpassword',
      emailVerified: new Date(),
      role: 'admin',
      banned: false,
    })

    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const result = await authorizeCredentials(
      { email: 'admin@example.com', password: 'password123' },
      { prisma: mockPrisma, requireAdmin: true }
    )

    expect(result?.role).toBe('admin')
    expect(result?.id).toBe('admin123')
  })

  it('should use custom role validator when provided', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user123',
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedpassword',
      emailVerified: new Date(),
      role: 'user',
      banned: false,
    })

    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    // Custom validator that rejects all users
    const roleValidator = vi.fn().mockReturnValue(false)

    const result = await authorizeCredentials(
      { email: 'test@example.com', password: 'password123' },
      { prisma: mockPrisma, roleValidator }
    )

    expect(roleValidator).toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('should pass custom role validator for valid roles', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user123',
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedpassword',
      emailVerified: new Date(),
      role: 'premium',
      banned: false,
    })

    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    // Custom validator that accepts "premium" role
    const roleValidator = vi.fn((user) => user.role === 'premium')

    const result = await authorizeCredentials(
      { email: 'test@example.com', password: 'password123' },
      { prisma: mockPrisma, roleValidator }
    )

    expect(roleValidator).toHaveBeenCalled()
    expect(result?.role).toBe('premium')
  })

  it('should default role to "user" if not provided', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user123',
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedpassword',
      emailVerified: new Date(),
      banned: false,
    })

    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const result = await authorizeCredentials(
      { email: 'test@example.com', password: 'password123' },
      { prisma: mockPrisma }
    )

    expect(result?.role).toBe('user')
  })

  it('should handle database errors gracefully', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'))

    const result = await authorizeCredentials(
      { email: 'test@example.com', password: 'password123' },
      { prisma: mockPrisma }
    )

    expect(result).toBeNull()
  })

  it('should handle undefined credentials', async () => {
    const result = await authorizeCredentials(undefined, { prisma: mockPrisma })

    expect(result).toBeNull()
  })

  it('should handle user without name or image', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user123',
      email: 'test@example.com',
      name: null,
      image: null,
      password: 'hashedpassword',
      emailVerified: new Date(),
      role: 'user',
      banned: false,
    })

    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const result = await authorizeCredentials(
      { email: 'test@example.com', password: 'password123' },
      { prisma: mockPrisma }
    )

    expect(result).toEqual({
      id: 'user123',
      email: 'test@example.com',
      name: null,
      image: null,
      role: 'user',
    })
  })
})
