import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@droiduse/shared-lib/server'
import { apiHandler } from '@/lib/api-helpers'

if (!process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET is not set')
}

export const POST = apiHandler(async (request: NextRequest) => {
  try {
    const { refreshToken } = await request.json()

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'refreshToken is required' },
        { status: 400 }
      )
    }

    // Verify refresh token
    let decoded: any
    try {
      decoded = jwt.verify(refreshToken, process.env.AUTH_SECRET!) as any
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired refresh token' },
        { status: 401 }
      )
    }

    if (decoded.type !== 'refresh') {
      return NextResponse.json(
        { success: false, error: 'Invalid token type' },
        { status: 401 }
      )
    }

    if (!decoded.userId) {
      return NextResponse.json(
        { success: false, error: 'Invalid token payload' },
        { status: 401 }
      )
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        banned: true,
        surveyCompleted: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user is banned
    if (user.banned) {
      return NextResponse.json(
        { success: false, error: 'Account is banned' },
        { status: 403 }
      )
    }

    // Generate new tokens
    const newAccessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role || 'user',
      },
      process.env.AUTH_SECRET!,
      { expiresIn: '7d' }
    )

    const newRefreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.AUTH_SECRET!,
      { expiresIn: '30d' }
    )

    return NextResponse.json({
      success: true,
      token: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
        tokenType: 'Bearer',
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.image,
        role: user.role || 'user',
        surveyCompleted: user.surveyCompleted ?? false,
      },
    })
  } catch (error) {
    console.error('[refresh] Token refresh error:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Token refresh failed',
      },
      { status: 500 }
    )
  }
})

