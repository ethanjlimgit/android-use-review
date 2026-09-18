import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import { prisma, deviceRegistrationService, getClientGeolocation, validateReferralCode, createPendingReferral, completeReferral } from '@droiduse/shared-lib/server'
import { PRICING_TIERS_CLIENT } from '@droiduse/shared-lib'
import { apiHandler } from '@/lib/api-helpers'

if (!process.env.AUTH_GOOGLE_ID) {
  throw new Error('AUTH_GOOGLE_ID is not set')
}

if (!process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET is not set')
}

const client = new OAuth2Client(process.env.AUTH_GOOGLE_ID)

interface FindOrCreateUserParams {
  email: string
  name?: string | null
  picture?: string | null
  provider: string
  providerId: string
  referrerId?: string
  referralCode?: string
}

interface FindOrCreateUserResult {
  user: NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>
  isNewUser: boolean
}

async function findOrCreateUser(params: FindOrCreateUserParams): Promise<FindOrCreateUserResult> {
  const { email, name, picture, provider, providerId, referrerId, referralCode } = params

  // First, try to find existing account
  const existingAccount = await prisma.account.findFirst({
    where: {
      provider: provider,
      providerAccountId: providerId,
    },
    include: { user: true },
  })

  if (existingAccount) {
    return { user: existingAccount.user, isNewUser: false }
  }

  // Try to find user by email
  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    // Link account to existing user
    await prisma.account.create({
      data: {
        userId: existingUser.id,
        type: 'oauth',
        provider: provider,
        providerAccountId: providerId,
      },
    })
    return { user: existingUser, isNewUser: false }
  }

  // Create new user and account with free tier credits
  const freeTierCredits = PRICING_TIERS_CLIENT.free.creditAllowance
  const newUser = await prisma.user.create({
    data: {
      email,
      name,
      image: picture,
      emailVerified: new Date(),
      subscriptionTier: 'free',
      creditAllowance: freeTierCredits,
      creditsUsed: 0,
      referredById: referrerId,
      accounts: {
        create: {
          type: 'oauth',
          provider: provider,
          providerAccountId: providerId,
        },
      },
    },
  })

  // Create and complete referral if referrer was provided
  // OAuth users are immediately verified, so complete the referral right away
  if (referrerId && referralCode) {
    const pendingReferral = await createPendingReferral(
      referrerId,
      newUser.id,
      referralCode,
      'mobile'
    )
    if (pendingReferral) {
      await completeReferral(newUser.id)
    }
  }

  return { user: newUser, isNewUser: true }
}

export const POST = apiHandler(async (request: NextRequest) => {
  try {
    const { idToken, deviceInfo, referralCode } = await request.json()

    if (!idToken) {
      return NextResponse.json(
        { success: false, error: 'idToken is required' },
        { status: 400 }
      )
    }

    // Validate referral code if provided
    let referrerId: string | undefined
    let validReferralCode: string | undefined
    if (referralCode && typeof referralCode === 'string' && referralCode.length === 8) {
      const referralResult = await validateReferralCode(referralCode)
      if (referralResult.valid && referralResult.referrerId) {
        referrerId = referralResult.referrerId
        validReferralCode = referralCode
      }
      // Silently ignore invalid referral codes - don't block signup
    }

    // Verify Google ID token
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.AUTH_GOOGLE_ID,
    })

    const payload = ticket.getPayload()
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      )
    }

    if (!payload.email) {
      return NextResponse.json(
        { success: false, error: 'Email not provided by Google' },
        { status: 400 }
      )
    }

    // Find or create user in database
    const { user } = await findOrCreateUser({
      email: payload.email,
      name: payload.name || null,
      picture: payload.picture || null,
      provider: 'google',
      providerId: payload.sub,
      referrerId,
      referralCode: validReferralCode,
    })

    // Check if user is banned
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
          console.error('[mobile-google] Error updating user geolocation:', error)
        })
      }
    } catch (error) {
      console.error('[mobile-google] Error capturing geolocation:', error)
      // Don't fail authentication if geolocation fails
    }

    // Register device (required for mobile auth)
    if (!deviceInfo) {
      return NextResponse.json(
        { success: false, error: 'deviceInfo is required' },
        { status: 400 }
      )
    }

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
          console.error('[mobile-google] Error updating device location:', error)
        })
      }
    } catch (error) {
      console.error('[mobile-google] Device registration failed:', error)
      return NextResponse.json(
        { success: false, error: 'Device registration failed' },
        { status: 500 }
      )
    }

    // Generate session JWT
    const sessionToken = jwt.sign(
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

    return NextResponse.json({
      success: true,
      token: {
        accessToken: sessionToken,
        refreshToken: refreshToken,
        expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
        tokenType: 'Bearer',
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.image,
        provider: 'GOOGLE',
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
    console.error('[mobile-google] Token exchange error:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Authentication failed',
      },
      { status: 500 }
    )
  }
})

