import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma, deviceRegistrationService, getClientGeolocation } from '@droiduse/shared-lib/server'
import { PRICING_TIERS_CLIENT } from '@droiduse/shared-lib'
import { apiHandler } from '@/lib/api-helpers'

if (!process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET is not set')
}

interface FindOrCreateUserParams {
  email: string | null
  name?: string | null
  picture?: string | null
  provider: string
  providerId: string
}

async function findOrCreateUser(params: FindOrCreateUserParams) {
  const { email, name, picture, provider, providerId } = params

  // First, try to find existing account
  const existingAccount = await prisma.account.findFirst({
    where: {
      provider: provider,
      providerAccountId: providerId,
    },
    include: { user: true },
  })

  if (existingAccount) {
    return existingAccount.user
  }

  // If email is provided, try to find user by email
  if (email) {
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
      return existingUser
    }
  }

  // Create new user and account with free tier credits
  const freeTierCredits = PRICING_TIERS_CLIENT.free.creditAllowance
  const newUser = await prisma.user.create({
    data: {
      email: email || undefined,
      name,
      image: picture,
      emailVerified: email ? new Date() : null,
      subscriptionTier: 'free',
      creditAllowance: freeTierCredits,
      creditsUsed: 0,
      accounts: {
        create: {
          type: 'oauth',
          provider: provider,
          providerAccountId: providerId,
        },
      },
    },
  })

  return newUser
}

export const POST = apiHandler(async (request: NextRequest) => {
  try {
    const { code, provider, redirectUri, codeVerifier, deviceInfo } = await request.json()

    if (!code || !provider) {
      return NextResponse.json(
        { success: false, error: 'code and provider are required' },
        { status: 400 }
      )
    }

    // Exchange code for access token with the OAuth provider
    let accessToken: string
    let userInfo: any

    if (provider === 'github') {
      if (!process.env.AUTH_GITHUB_ID || !process.env.AUTH_GITHUB_SECRET) {
        return NextResponse.json(
          { success: false, error: 'GitHub OAuth not configured' },
          { status: 500 }
        )
      }

      // Exchange GitHub code
      const tokenResponse = await fetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: process.env.AUTH_GITHUB_ID,
            client_secret: process.env.AUTH_GITHUB_SECRET,
            code: code,
            redirect_uri: redirectUri,
          }),
        }
      )

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange GitHub code')
      }

      const tokenData = await tokenResponse.json()

      if (tokenData.error) {
        return NextResponse.json(
          { success: false, error: tokenData.error_description || tokenData.error },
          { status: 400 }
        )
      }

      accessToken = tokenData.access_token

      // Get user info
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })

      if (!userResponse.ok) {
        throw new Error('Failed to fetch GitHub user info')
      }

      userInfo = await userResponse.json()

      // Get user email (may require additional API call)
      let email = userInfo.email
      if (!email) {
        const emailResponse = await fetch(
          'https://api.github.com/user/emails',
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        )
        if (emailResponse.ok) {
          const emails = await emailResponse.json()
          const primaryEmail = emails.find((e: any) => e.primary)
          email = primaryEmail?.email || emails[0]?.email || null
        }
      }

      userInfo.email = email

    } else if (provider === 'twitter') {
      if (!process.env.AUTH_TWITTER_ID || !process.env.AUTH_TWITTER_SECRET) {
        return NextResponse.json(
          { success: false, error: 'Twitter OAuth not configured' },
          { status: 500 }
        )
      }

      // Twitter OAuth 2.0 code exchange
      const tokenResponse = await fetch(
        'https://api.twitter.com/2/oauth2/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(
              `${process.env.AUTH_TWITTER_ID}:${process.env.AUTH_TWITTER_SECRET}`
            ).toString('base64')}`,
          },
          body: new URLSearchParams({
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri || '',
            code_verifier: codeVerifier || '',
          }),
        }
      )

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}))
        throw new Error(
          errorData.error_description || 'Failed to exchange Twitter code'
        )
      }

      const tokenData = await tokenResponse.json()
      accessToken = tokenData.access_token

      // Get user info from Twitter API v2
      const userResponse = await fetch(
        'https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!userResponse.ok) {
        throw new Error('Failed to fetch Twitter user info')
      }

      const twitterData = await userResponse.json()
      userInfo = {
        id: twitterData.data.id,
        name: twitterData.data.name,
        username: twitterData.data.username,
        picture: twitterData.data.profile_image_url,
        email: null, // Twitter doesn't provide email by default
      }
    } else {
      return NextResponse.json(
        { success: false, error: `Unsupported provider: ${provider}` },
        { status: 400 }
      )
    }

    // Find or create user
    const user = await findOrCreateUser({
      email: userInfo.email || null,
      name: userInfo.name || userInfo.login || userInfo.username || null,
      picture:
        userInfo.avatar_url ||
        userInfo.picture ||
        userInfo.profile_image_url ||
        null,
      provider: provider,
      providerId: userInfo.id.toString(),
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
          console.error('[mobile-oauth] Error updating user geolocation:', error)
        })
      }
    } catch (error) {
      console.error('[mobile-oauth] Error capturing geolocation:', error)
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
          console.error('[mobile-oauth] Error updating device location:', error)
        })
      }
    } catch (error) {
      console.error('[mobile-oauth] Device registration failed:', error)
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
        provider: provider.toUpperCase(),
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
    console.error('[mobile-oauth] Code exchange error:', error)
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

