import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, validateBody } from '@/lib/api-helpers'
import {
  storage,
  resetPasswordSchema,
  bcrypt
} from '@droiduse/shared-lib/server'

/**
 * POST /api/auth/reset-password
 * Complete password reset with token
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const body = await validateBody(request, resetPasswordSchema)
  const { token, password } = body

  // Validate token and get associated user
  const resetToken = await storage.getPasswordResetToken(token)

  if (!resetToken || resetToken.type !== 'PASSWORD_RESET') {
    return NextResponse.json(
      { error: 'Invalid or expired reset token' },
      { status: 400 }
    )
  }

  // Check if token has already been used
  if (resetToken.usedAt) {
    return NextResponse.json(
      { error: 'This reset token has already been used' },
      { status: 400 }
    )
  }

  // Check if token has expired
  if (new Date() > resetToken.expiresAt) {
    return NextResponse.json(
      { error: 'This reset token has expired. Please request a new one.' },
      { status: 400 }
    )
  }

  // Get user
  const user = await storage.getUser(resetToken.userId)

  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    )
  }

  // Hash new password (salt rounds: 10, matching signup route)
  const hashedPassword = await bcrypt.hash(password, 10)

  // Update user password
  await storage.prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  })

  // Mark token as used
  await storage.markPasswordResetTokenAsUsed(token)

  console.log(`[reset-password] Password reset successful for user ${user.email}`)

  return NextResponse.json(
    {
      message: 'Password reset successful. You can now sign in with your new password.',
      success: true,
    },
    { status: 200 }
  )
})
