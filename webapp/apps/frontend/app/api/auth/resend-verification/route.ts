import { NextRequest, NextResponse } from "next/server"
import { prisma, emailService } from "@droiduse/shared-lib/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { z } from "zod"
import { ApiError, validateBody } from "@/lib/api-helpers"

const resendSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await validateBody(request, resendSchema)

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      // Don't reveal if user exists or not
      return NextResponse.json(
        { message: "If an account exists with this email, a verification link has been sent." },
        { status: 200 }
      )
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { message: "This email is already verified. You can sign in." },
        { status: 400 }
      )
    }

    // If password is provided, verify it
    if (password) {
      if (!user.password) {
        return NextResponse.json(
          { message: "This account uses social login. Please sign in with your social provider." },
          { status: 400 }
        )
      }

      const isValidPassword = await bcrypt.compare(password, user.password)
      if (!isValidPassword) {
        return NextResponse.json(
          { message: "Invalid password. Please check your password and try again." },
          { status: 401 }
        )
      }
    }

    // Delete existing unused tokens for this user
    await prisma.userToken.deleteMany({
      where: {
        userId: user.id,
        type: 'EMAIL_VERIFICATION',
        usedAt: null,
      },
    })

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now

    // Create verification token in database
    await prisma.userToken.create({
      data: {
        userId: user.id,
        type: 'EMAIL_VERIFICATION',
        token: verificationToken,
        expiresAt,
      },
    })

    // Send verification email
    const emailSent = await emailService.sendVerificationEmail({
      to: user.email!,
      name: user.name,
      verificationToken,
    })

    if (!emailSent) {
      console.error('Failed to send verification email to', user.email)
      return NextResponse.json(
        { message: "Failed to send verification email. Please try again later." },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Verification email sent. Please check your inbox." },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      return NextResponse.json(
        { message: "Invalid email address" },
        { status: 400 }
      )
    }

    console.error("Resend verification error:", error)
    return NextResponse.json(
      { message: "Failed to resend verification email" },
      { status: 500 }
    )
  }
}
