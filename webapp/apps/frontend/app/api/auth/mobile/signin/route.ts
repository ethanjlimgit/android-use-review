import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma, deviceRegistrationService, authorizeCredentials, getClientGeolocation, validateReferralCode, createPendingReferral, completeReferral } from '@droiduse/shared-lib/server'
import { ApiError, apiHandler, validateBody } from '@/lib/api-helpers'
import { PRICING_TIERS_CLIENT } from '@droiduse/shared-lib'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

if (!process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET is not set')
}

// Validation schema
const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  deviceInfo: z.object({
    deviceId: z.string(),
    name: z.string(),
    manufacturer: z.string(),
    model: z.string(),
    osVersion: z.string(),
    apiLevel: z.number().optional(),
    displayMetrics: z.object({
      widthPixels: z.number(),
      heightPixels: z.number(),
      densityDpi: z.number(),
      density: z.number(),
      refreshRate: z.number().optional(),
    }),
  }),
  referralCode: z.string().length(8).optional(),
  isNewUser: z.boolean().optional(), // Flag to indicate this is a signup, not signin
})

export const POST = apiHandler(async (request: NextRequest) => {
  try {
    const validatedData = await validateBody(request, signInSchema)
    const { email, password, deviceInfo } = validatedData

    // Use shared authorizeCredentials - handles all validation
    const authUser = await authorizeCredentials(
      { email, password },
      { prisma }
    )

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials or email not verified' },
        { status: 401 }
      )
    }

    // Get full user from database
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        banned: true,
        surveyCompleted: true,
        accounts: { select: { provider: true } }
      }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check banned (redundant but explicit)
    if (user.banned) {
      return NextResponse.json(
        { success: false, error: 'Account is banned' },
        { status: 403 }
      )
    }

    // Capture IP geolocation
    let geolocation = null
    try {
      geolocation = await getClientGeolocation(request.headers)

      if (geolocation) {
        // Update user's last login location
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginIp: geolocation.ip,
            lastLoginCountry: geolocation.country,
            lastLoginCity: geolocation.city,
            lastLoginAt: new Date(),
          },
        }).catch((error) => {
          console.error('[mobile-signin] Error updating user geolocation:', error)
        })
      }
    } catch (error) {
      console.error('[mobile-signin] Error capturing geolocation:', error)
      // Don't fail authentication if geolocation fails
    }

    // Register device (required for mobile auth)
    let registeredDevice
    try {
      registeredDevice = await deviceRegistrationService.registerDevice(
        user.id,
        deviceInfo
      )

      // Update device location if geolocation was successful
      if (geolocation && geolocation.latitude && geolocation.longitude) {
        await prisma.device.updateMany({
          where: {
            userId: user.id,
            deviceId: deviceInfo.deviceId,
          },
          data: {
            longitude: geolocation.longitude,
            latitude: geolocation.latitude,
            locationUpdatedAt: new Date(),
          },
        }).catch((error) => {
          console.error('[mobile-signin] Error updating device location:', error)
        })
      }
    } catch (error) {
      console.error('[mobile-signin] Device registration failed:', error)
      return NextResponse.json(
        { success: false, error: 'Device registration failed' },
        { status: 500 }
      )
    }

    // Generate JWT tokens (7-day access, 30-day refresh)
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role || 'user',
      },
      process.env.AUTH_SECRET!,
      { expiresIn: '7d' }
    )

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.AUTH_SECRET!,
      { expiresIn: '30d' }
    )

    // Determine provider (EMAIL if no OAuth accounts)
    const provider = user.accounts.length > 0
      ? user.accounts[0].provider.toUpperCase()
      : 'EMAIL'

    return NextResponse.json({
      success: true,
      token: {
        accessToken,
        refreshToken,
        expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
        tokenType: 'Bearer',
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.image,
        provider,
        role: user.role || 'user',
        surveyCompleted: user.surveyCompleted ?? false,
      },
      device: {
        id: registeredDevice.id,
        deviceId: registeredDevice.deviceId,
        name: registeredDevice.name,
      },
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data' },
        { status: 400 }
      )
    }

    console.error('[mobile-signin] Signin error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      },
      { status: 500 }
    )
  }
})
