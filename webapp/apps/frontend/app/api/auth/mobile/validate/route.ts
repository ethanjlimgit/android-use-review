import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@droiduse/shared-lib/server'
import { ApiError, apiHandler, validateBody } from '@/lib/api-helpers'
import { z } from 'zod'

if (!process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET is not set')
}

const validateSchema = z.object({
  accessToken: z.string().min(1, 'Access token is required'),
})

export const POST = apiHandler(async (request: NextRequest) => {
  try {
    const { accessToken } = await validateBody(request, validateSchema)

    // Verify JWT signature and expiry
    let decoded: any
    try {
      decoded = jwt.verify(accessToken, process.env.AUTH_SECRET!) as any
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired access token' },
        { status: 401 }
      )
    }

    // Validate payload structure
    if (!decoded.userId || !decoded.email) {
      return NextResponse.json(
        { success: false, error: 'Invalid token payload' },
        { status: 401 }
      )
    }

    // Ensure it's NOT a refresh token
    if (decoded.type === 'refresh') {
      return NextResponse.json(
        { success: false, error: 'Invalid token type' },
        { status: 401 }
      )
    }

    // Fetch user from database (don't fully trust token)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        banned: true,
        accounts: { select: { provider: true } }
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user is banned (even if token is valid)
    if (user.banned) {
      return NextResponse.json(
        { success: false, error: 'Account is banned' },
        { status: 403 }
      )
    }

    // Determine provider
    const provider = user.accounts.length > 0
      ? user.accounts[0].provider.toUpperCase()
      : 'EMAIL'

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.image,
        provider,
        role: user.role || 'user',
      },
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      return NextResponse.json(
        { success: false, error: 'Access token is required' },
        { status: 400 }
      )
    }

    console.error('[mobile-validate] Validation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      },
      { status: 500 }
    )
  }
})
