import { describe, it, expect } from 'vitest'
import {
  insertUserSchema,
  insertAppSchema,
  insertSkillSchema,
  insertDeviceSchema,
  deviceInfoSchema,
  insertBlogPostSchema,
  insertTaskSchema,
  updateTaskSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createCheckoutSessionSchema,
} from './schemas'

describe('User Schema', () => {
  it('should validate correct user data', () => {
    const validUser = {
      username: 'testuser',
      password: 'password123',
    }

    const result = insertUserSchema.safeParse(validUser)
    expect(result.success).toBe(true)
  })

  it('should reject user without username', () => {
    const invalidUser = {
      password: 'password123',
    }

    const result = insertUserSchema.safeParse(invalidUser)
    expect(result.success).toBe(false)
  })

  it('should reject user without password', () => {
    const invalidUser = {
      username: 'testuser',
    }

    const result = insertUserSchema.safeParse(invalidUser)
    expect(result.success).toBe(false)
  })
})

describe('App Schema', () => {
  it('should validate app with all required fields', () => {
    const validApp = {
      packagePath: 'com.example.app',
      name: 'Test App',
      version: '1.0.0',
    }

    const result = insertAppSchema.safeParse(validApp)
    expect(result.success).toBe(true)
  })

  it('should accept optional fields as null', () => {
    const appWithNulls = {
      packagePath: 'com.example.app',
      name: 'Test App',
      version: '1.0.0',
      iconUrl: null,
      category: null,
    }

    const result = insertAppSchema.safeParse(appWithNulls)
    expect(result.success).toBe(true)
  })

  it('should accept optional fields as undefined', () => {
    const minimalApp = {
      packagePath: 'com.example.app',
      name: 'Test App',
      version: '1.0.0',
    }

    const result = insertAppSchema.safeParse(minimalApp)
    expect(result.success).toBe(true)
  })
})

describe('Skill Schema', () => {
  it('should validate skill with all required fields', () => {
    const validSkill = {
      title: 'How to use Gmail',
      description: 'A guide to using Gmail app',
      appId: 'app-123',
    }

    const result = insertSkillSchema.safeParse(validSkill)
    expect(result.success).toBe(true)
  })

  it('should accept optional fields', () => {
    const skillWithOptionals = {
      title: 'How to use Gmail',
      description: 'A guide to using Gmail app',
      appId: 'app-123',
      authorId: 'user-456',
      score: 4.5,
      downloads: 100,
      featured: true,
    }

    const result = insertSkillSchema.safeParse(skillWithOptionals)
    expect(result.success).toBe(true)
  })

  it('should reject skill without required fields', () => {
    const invalidSkill = {
      title: 'Test',
    }

    const result = insertSkillSchema.safeParse(invalidSkill)
    expect(result.success).toBe(false)
  })
})

describe('Device Schema', () => {
  it('should validate device with all required fields', () => {
    const validDevice = {
      name: 'Pixel 8',
      deviceId: 'device-123',
      deviceTypeId: 'android',
    }

    const result = insertDeviceSchema.safeParse(validDevice)
    expect(result.success).toBe(true)
  })

  it('should accept optional fields', () => {
    const deviceWithOptionals = {
      userId: 'user-123',
      name: 'Pixel 8',
      deviceId: 'device-123',
      deviceTypeId: 'android',
      osVersion: '14',
      status: 'online',
      fcmToken: 'fcm-token-123',
    }

    const result = insertDeviceSchema.safeParse(deviceWithOptionals)
    expect(result.success).toBe(true)
  })
})

describe('Device Info Schema', () => {
  it('should validate complete device info', () => {
    const validDeviceInfo = {
      deviceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Device',
      manufacturer: 'Google',
      model: 'Pixel 8',
      osVersion: '14',
      apiLevel: 34,
      displayMetrics: {
        widthPixels: 1080,
        heightPixels: 2400,
        density: 2.5,
        densityDpi: 420,
      },
    }

    const result = deviceInfoSchema.safeParse(validDeviceInfo)
    expect(result.success).toBe(true)
  })

  it('should require valid UUID for deviceId', () => {
    const invalidDevice = {
      deviceId: 'not-a-uuid',
      name: 'Test',
      manufacturer: 'Google',
      model: 'Pixel',
      osVersion: '14',
      displayMetrics: {
        widthPixels: 1080,
        heightPixels: 2400,
        density: 2.5,
        densityDpi: 420,
      },
    }

    const result = deviceInfoSchema.safeParse(invalidDevice)
    expect(result.success).toBe(false)
  })

  it('should accept optional screen refresh rate', () => {
    const deviceWithRefreshRate = {
      deviceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Device',
      manufacturer: 'Google',
      model: 'Pixel 8',
      osVersion: '14',
      displayMetrics: {
        widthPixels: 1080,
        heightPixels: 2400,
        density: 2.5,
        densityDpi: 420,
      },
      screenRefreshRate: 120,
    }

    const result = deviceInfoSchema.safeParse(deviceWithRefreshRate)
    expect(result.success).toBe(true)
  })
})

describe('Blog Post Schema', () => {
  it('should validate blog post with all required fields', () => {
    const validPost = {
      title: 'My First Post',
      slug: 'my-first-post',
      content: 'This is the content',
      authorId: 'user-123',
    }

    const result = insertBlogPostSchema.safeParse(validPost)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('draft')
      expect(result.data.featured).toBe(false)
    }
  })

  it('should enforce slug format', () => {
    const invalidSlug = {
      title: 'My Post',
      slug: 'My Post With Spaces',
      content: 'Content',
      authorId: 'user-123',
    }

    const result = insertBlogPostSchema.safeParse(invalidSlug)
    expect(result.success).toBe(false)
  })

  it('should accept valid slug with hyphens', () => {
    const validPost = {
      title: 'My Post',
      slug: 'my-post-with-hyphens',
      content: 'Content',
      authorId: 'user-123',
    }

    const result = insertBlogPostSchema.safeParse(validPost)
    expect(result.success).toBe(true)
  })

  it('should validate status enum', () => {
    const publishedPost = {
      title: 'Published Post',
      slug: 'published-post',
      content: 'Content',
      authorId: 'user-123',
      status: 'published' as const,
    }

    const result = insertBlogPostSchema.safeParse(publishedPost)
    expect(result.success).toBe(true)
  })
})

describe('Task Schema', () => {
  it('should validate task with required fields', () => {
    const validTask = {
      deviceId: 'device-123',
      goal: 'Open Gmail and send an email',
    }

    const result = insertTaskSchema.safeParse(validTask)
    expect(result.success).toBe(true)
  })

  it('should enforce minimum goal length', () => {
    const shortGoal = {
      deviceId: 'device-123',
      goal: 'Hi',
    }

    const result = insertTaskSchema.safeParse(shortGoal)
    expect(result.success).toBe(false)
  })

  it('should accept optional fields', () => {
    const taskWithOptionals = {
      deviceId: 'device-123',
      goal: 'Open Gmail and send an email',
      userId: 'user-123',
      runType: 'scheduled',
      isReasoning: true,
      maxSteps: 50,
      timeoutSec: 300,
    }

    const result = insertTaskSchema.safeParse(taskWithOptionals)
    expect(result.success).toBe(true)
  })

  it('should enforce positive maxSteps', () => {
    const invalidTask = {
      deviceId: 'device-123',
      goal: 'Test goal',
      maxSteps: 0,
    }

    const result = insertTaskSchema.safeParse(invalidTask)
    expect(result.success).toBe(false)
  })
})

describe('Update Task Schema', () => {
  it('should validate task status updates', () => {
    const statusUpdate = {
      status: 'RUNNING' as const,
      currentStep: 5,
      totalSteps: 10,
    }

    const result = updateTaskSchema.safeParse(statusUpdate)
    expect(result.success).toBe(true)
  })

  it('should accept date transformations', () => {
    const dateUpdate = {
      completedAt: '2024-01-01T12:00:00Z',
    }

    const result = updateTaskSchema.safeParse(dateUpdate)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.completedAt).toBeInstanceOf(Date)
    }
  })
})

describe('Forgot Password Schema', () => {
  it('should validate correct email', () => {
    const validEmail = {
      email: 'user@example.com',
    }

    const result = forgotPasswordSchema.safeParse(validEmail)
    expect(result.success).toBe(true)
  })

  it('should reject invalid email', () => {
    const invalidEmail = {
      email: 'not-an-email',
    }

    const result = forgotPasswordSchema.safeParse(invalidEmail)
    expect(result.success).toBe(false)
  })
})

describe('Reset Password Schema', () => {
  it('should validate correct reset data', () => {
    const validReset = {
      token: 'reset-token-123',
      password: 'newpassword123',
    }

    const result = resetPasswordSchema.safeParse(validReset)
    expect(result.success).toBe(true)
  })

  it('should enforce minimum password length', () => {
    const shortPassword = {
      token: 'reset-token-123',
      password: '123',
    }

    const result = resetPasswordSchema.safeParse(shortPassword)
    expect(result.success).toBe(false)
  })
})

describe('Checkout Session Schema', () => {
  it('should validate checkout session with priceId', () => {
    const validCheckout = {
      priceId: 'price_123',
    }

    const result = createCheckoutSessionSchema.safeParse(validCheckout)
    expect(result.success).toBe(true)
  })

  it('should accept optional URLs', () => {
    const checkoutWithUrls = {
      priceId: 'price_123',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }

    const result = createCheckoutSessionSchema.safeParse(checkoutWithUrls)
    expect(result.success).toBe(true)
  })

  it('should enforce valid URL format', () => {
    const invalidUrl = {
      priceId: 'price_123',
      successUrl: 'not-a-url',
    }

    const result = createCheckoutSessionSchema.safeParse(invalidUrl)
    expect(result.success).toBe(false)
  })
})
