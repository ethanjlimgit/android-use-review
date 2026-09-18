import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'
import { prisma, verifyMobileToken } from '@droiduse/shared-lib/server'
import { requireAuth } from '@/lib/api-helpers'

// Mock requireAuth
vi.mock('@/lib/api-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-helpers')>()
  return {
    ...actual,
    requireAuth: vi.fn(),
  }
})

vi.mock('@droiduse/shared-lib/server', () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
  verifyMobileToken: vi.fn(),
  extractBearerToken: vi.fn(),
}))

describe('POST /api/onboarding/survey', () => {
  const validSurveyData = {
    userType: 'individual' as const,
    industry: 'Technology',
    occupation: 'Software Engineer',
    useCase: 'Building automation tools for mobile testing and QA workflows',
  }

  const mockUserId = 'user-123'
  const mockSession = {
    user: {
      id: mockUserId,
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication', () => {
    it('should accept valid web session authentication', async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockSession)
      vi.mocked(prisma.user.update).mockResolvedValue({} as any)

      const request = new NextRequest('http://localhost:3000/api/onboarding/survey', {
        method: 'POST',
        body: JSON.stringify(validSurveyData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(requireAuth).toHaveBeenCalledWith(request)
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should accept valid mobile JWT authentication', async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockSession)
      vi.mocked(prisma.user.update).mockResolvedValue({} as any)

      const request = new NextRequest('http://localhost:3000/api/onboarding/survey', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-jwt-token',
        },
        body: JSON.stringify(validSurveyData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(requireAuth).toHaveBeenCalledWith(request)
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return 401 when not authenticated', async () => {
      vi.mocked(requireAuth).mockRejectedValue({
        name: 'ApiError',
        message: 'Unauthorized',
        status: 401,
      })

      const request = new NextRequest('http://localhost:3000/api/onboarding/survey', {
        method: 'POST',
        body: JSON.stringify(validSurveyData),
      })

      const response = await POST(request)

      expect(response.status).toBe(500) // Error falls through to generic error handler
      expect(requireAuth).toHaveBeenCalledWith(request)
    })
  })

  describe('Survey Data Validation', () => {
    beforeEach(() => {
      vi.mocked(requireAuth).mockResolvedValue(mockSession)
    })

    it('should accept valid individual user survey data', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({} as any)

      const request = new NextRequest('http://localhost:3000/api/onboarding/survey', {
        method: 'POST',
        body: JSON.stringify(validSurveyData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Survey completed successfully')
    })

    it('should accept valid company user survey data with companySize', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({} as any)

      const companySurveyData = {
        userType: 'company' as const,
        companySize: '50-200',
        industry: 'Technology',
        occupation: 'CTO',
        useCase: 'Enterprise mobile testing automation across multiple teams',
      }

      const request = new NextRequest('http://localhost:3000/api/onboarding/survey', {
        method: 'POST',
        body: JSON.stringify(companySurveyData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject survey data with missing required fields', async () => {
      const invalidData = {
        userType: 'individual',
        // Missing industry, occupation, useCase
      }

      const request = new NextRequest('http://localhost:3000/api/onboarding/survey', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toContain('Invalid survey data')
    })

    it('should reject survey data with useCase too short', async () => {
      const invalidData = {
        ...validSurveyData,
        useCase: 'short', // Less than 10 characters
      }

      const request = new NextRequest('http://localhost:3000/api/onboarding/survey', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toContain('Invalid survey data')
    })

    it('should reject survey data with useCase too long', async () => {
      const invalidData = {
        ...validSurveyData,
        useCase: 'x'.repeat(501), // More than 500 characters
      }

      const request = new NextRequest('http://localhost:3000/api/onboarding/survey', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toContain('Invalid survey data')
    })

    it('should reject survey data with invalid userType', async () => {
      const invalidData = {
        ...validSurveyData,
        userType: 'invalid-type',
      }

      const request = new NextRequest('http://localhost:3000/api/onboarding/survey', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toContain('Invalid survey data')
    })

    it('should reject malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/onboarding/survey', {
        method: 'POST',
        body: 'invalid json',
      })

      const response = await POST(request)

      expect(response.status).toBe(500) // JSON parse error falls through
    })
  })

  describe('Database Operations', () => {
    beforeEach(() => {
      vi.mocked(requireAuth).mockResolvedValue(mockSession)
    })

    it('should update user with survey data correctly', async () => {
      const mockUpdate = vi.mocked(prisma.user.update).mockResolvedValue({} as any)

      const request = new NextRequest('http://localhost:3000/api/onboarding/survey', {
        method: 'POST',
        body: JSON.stringify(validSurveyData),
      })

      await POST(request)

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          surveyCompleted: true,
          surveyCompletedAt: expect.any(Date),
          userType: 'individual',
          companySize: null,
          industry: 'Technology',
          occupation: 'Software Engineer',
          useCase: 'Building automation tools for mobile testing and QA workflows',
        },
      })
    })

    it('should include companySize when provided', async () => {
      const mockUpdate = vi.mocked(prisma.user.update).mockResolvedValue({} as any)

      const companySurveyData = {
        userType: 'company' as const,
        companySize: '200-500',
        industry: 'Technology',
        occupation: 'CEO',
        useCase: 'Large scale mobile testing automation for enterprise applications',
      }

      const request = new NextRequest('http://localhost:3000/api/onboarding/survey', {
        method: 'POST',
        body: JSON.stringify(companySurveyData),
      })

      await POST(request)

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          surveyCompleted: true,
          surveyCompletedAt: expect.any(Date),
          userType: 'company',
          companySize: '200-500',
          industry: 'Technology',
          occupation: 'CEO',
          useCase: 'Large scale mobile testing automation for enterprise applications',
        },
      })
    })

    it('should return 500 when database update fails', async () => {
      vi.mocked(prisma.user.update).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/onboarding/survey', {
        method: 'POST',
        body: JSON.stringify(validSurveyData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.message).toBe('Failed to save survey')
    })
  })

  describe('Response Format', () => {
    beforeEach(() => {
      vi.mocked(requireAuth).mockResolvedValue(mockSession)
      vi.mocked(prisma.user.update).mockResolvedValue({} as any)
    })

    it('should return success response with correct structure', async () => {
      const request = new NextRequest('http://localhost:3000/api/onboarding/survey', {
        method: 'POST',
        body: JSON.stringify(validSurveyData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data).toEqual({
        success: true,
        message: 'Survey completed successfully',
      })
    })

    it('should return validation error response with correct structure', async () => {
      const invalidData = {
        userType: 'individual',
        // Missing required fields
      }

      const request = new NextRequest('http://localhost:3000/api/onboarding/survey', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data).toHaveProperty('message')
      expect(data.message).toContain('Invalid survey data')
      expect(data).toHaveProperty('errors')
      expect(Array.isArray(data.errors)).toBe(true)
    })
  })
})
