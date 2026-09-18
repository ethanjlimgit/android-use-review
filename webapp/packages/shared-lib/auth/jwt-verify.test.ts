import { describe, it, expect, beforeEach, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { verifyMobileToken, extractBearerToken } from './jwt-verify'

const TEST_SECRET = 'test-secret-key-minimum-32-characters-long'

describe('verifyMobileToken', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = TEST_SECRET
  })

  it('should verify valid token and return user data', () => {
    const payload = {
      userId: 'user123',
      email: 'test@example.com',
      role: 'user',
    }

    const token = jwt.sign(payload, TEST_SECRET)
    const result = verifyMobileToken(token)

    expect(result).toEqual({
      id: 'user123',
      email: 'test@example.com',
      name: null,
      image: null,
      role: 'user',
    })
  })

  it('should return null for invalid token', () => {
    const result = verifyMobileToken('invalid-token')
    expect(result).toBeNull()
  })

  it('should return null for expired token', () => {
    const payload = {
      userId: 'user123',
      email: 'test@example.com',
      role: 'user',
    }

    const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '-1s' })
    const result = verifyMobileToken(token)

    expect(result).toBeNull()
  })

  it('should return null if userId is missing', () => {
    const payload = {
      email: 'test@example.com',
      role: 'user',
    }

    const token = jwt.sign(payload, TEST_SECRET)
    const result = verifyMobileToken(token)

    expect(result).toBeNull()
  })

  it('should return null if email is missing', () => {
    const payload = {
      userId: 'user123',
      role: 'user',
    }

    const token = jwt.sign(payload, TEST_SECRET)
    const result = verifyMobileToken(token)

    expect(result).toBeNull()
  })

  it('should default role to "user" if not provided', () => {
    const payload = {
      userId: 'user123',
      email: 'test@example.com',
    }

    const token = jwt.sign(payload, TEST_SECRET)
    const result = verifyMobileToken(token)

    expect(result?.role).toBe('user')
  })

  it('should use custom secret if provided', () => {
    const customSecret = 'custom-secret-key-minimum-32-chars'
    const payload = {
      userId: 'user123',
      email: 'test@example.com',
      role: 'admin',
    }

    const token = jwt.sign(payload, customSecret)
    const result = verifyMobileToken(token, customSecret)

    expect(result?.id).toBe('user123')
    expect(result?.role).toBe('admin')
  })

  it('should return null if AUTH_SECRET is not set', () => {
    delete process.env.AUTH_SECRET
    const payload = {
      userId: 'user123',
      email: 'test@example.com',
      role: 'user',
    }

    const token = jwt.sign(payload, TEST_SECRET)
    const result = verifyMobileToken(token)

    expect(result).toBeNull()
  })

  it('should verify token with admin role', () => {
    const payload = {
      userId: 'admin123',
      email: 'admin@example.com',
      role: 'admin',
    }

    const token = jwt.sign(payload, TEST_SECRET)
    const result = verifyMobileToken(token)

    expect(result?.role).toBe('admin')
  })

  it('should handle token with extra claims', () => {
    const payload = {
      userId: 'user123',
      email: 'test@example.com',
      role: 'user',
      extraClaim: 'value',
    }

    const token = jwt.sign(payload, TEST_SECRET)
    const result = verifyMobileToken(token)

    expect(result).toEqual({
      id: 'user123',
      email: 'test@example.com',
      name: null,
      image: null,
      role: 'user',
    })
  })
})

describe('extractBearerToken', () => {
  it('should extract token from valid Bearer header', () => {
    const token = extractBearerToken('Bearer abc123xyz')
    expect(token).toBe('abc123xyz')
  })

  it('should return null for null header', () => {
    const token = extractBearerToken(null)
    expect(token).toBeNull()
  })

  it('should return null for malformed header without Bearer', () => {
    const token = extractBearerToken('InvalidFormat token123')
    expect(token).toBeNull()
  })

  it('should return null for header without token', () => {
    const token = extractBearerToken('Bearer')
    expect(token).toBeNull()
  })

  it('should return null for header with extra parts', () => {
    const token = extractBearerToken('Bearer token extra')
    expect(token).toBeNull()
  })

  it('should extract long token', () => {
    const longToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.abcdef123456'
    const token = extractBearerToken(`Bearer ${longToken}`)
    expect(token).toBe(longToken)
  })

  it('should be case-sensitive for Bearer keyword', () => {
    const token = extractBearerToken('bearer token123')
    expect(token).toBeNull()
  })

  it('should be case-sensitive for BEARER keyword', () => {
    const token = extractBearerToken('BEARER token123')
    expect(token).toBeNull()
  })

  it('should handle empty string header', () => {
    const token = extractBearerToken('')
    expect(token).toBeNull()
  })
})
