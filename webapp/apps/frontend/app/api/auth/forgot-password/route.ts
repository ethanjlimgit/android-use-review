import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, validateBody } from '@/lib/api-helpers'
import {
  storage,
  emailService,
  forgotPasswordSchema
} from '@droiduse/shared-lib/server'
import { randomBytes } from 'crypto'

/**
 * POST /api/auth/forgot-password
 * Request a password reset email
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const body = await validateBody(request, forgotPasswordSchema)
  const { email } = body

  // IMPORTANT SECURITY: Always return same response regardless of whether user exists
  // This prevents email enumeration attacks
  const successResponse = {
    message: 'If an account exists with this email, you will receive a password reset link.',
  }

  try {
    // Find user by email (normalize to lowercase)
    const user = await storage.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true, password: true },
    })

    // If user doesn't exist or has no password (OAuth only), return success anyway
    if (!user || !user.password) {
      console.log(`[forgot-password] User not found or no password set: ${email}`)
      // Wait a bit to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100))
      return NextResponse.json(successResponse, { status: 200 })
    }

    // Delete any existing password reset tokens for this user
    await storage.deleteUserPasswordResetTokens(user.id)

    // Generate secure random token (32 bytes = 64 hex characters)
    const resetToken = randomBytes(32).toString('hex')

    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    // Store token in database
    await storage.createPasswordResetToken({
      userId: user.id,
      type: 'PASSWORD_RESET',
      token: resetToken,
      expiresAt,
    })

    // Send email
    const emailSent = await emailService.sendPasswordResetEmail({
      to: user.email!,
      name: user.name,
      resetToken,
    })

    if (!emailSent) {
      console.error(`[forgot-password] Failed to send email to ${email}`)
      // Still return success to prevent email enumeration
      // Log error for admin investigation
    }

    console.log(`[forgot-password] Password reset email sent to ${email}`)
    return NextResponse.json(successResponse, { status: 200 })
  } catch (error) {
    console.error('[forgot-password] Error:', error)
    // Return generic error without revealing details
    return NextResponse.json(
      { error: 'An error occurred. Please try again later.' },
      { status: 500 }
    )
  }
})
