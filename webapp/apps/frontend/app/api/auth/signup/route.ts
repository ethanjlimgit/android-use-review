import { NextRequest, NextResponse } from "next/server"
import { prisma, validateReferralCode, createPendingReferral } from "@droiduse/shared-lib/server"
import { emailService } from "@droiduse/shared-lib/server"
import { PRICING_TIERS_CLIENT } from "@droiduse/shared-lib"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { z } from "zod"
import { ApiError, validateBody } from "@/lib/api-helpers"

const signUpSchema = z.object({
  name: z.union([
    z.string().min(2, "Name must be at least 2 characters"),
    z.literal(""),
  ]).optional(),
  email: z.string().email(),
  password: z.string().min(6),
  referralCode: z.string().length(8).optional(),
  product: z.enum(["ask-boris", "ask-charlie", "androiduse"]).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const validatedData = await validateBody(request, signUpSchema)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "ACCOUNT_EXISTS", message: "An account with this email already exists" },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    // Validate referral code if provided
    let referrerId: string | undefined
    if (validatedData.referralCode) {
      const referralResult = await validateReferralCode(validatedData.referralCode)
      if (referralResult.valid && referralResult.referrerId) {
        referrerId = referralResult.referrerId
      }
      // Silently ignore invalid referral codes - don't block signup
    }

    // Create user (email not verified yet) with free tier credits
    const freeTierCredits = PRICING_TIERS_CLIENT.free.creditAllowance
    const user = await prisma.user.create({
      data: {
        name: validatedData.name ?? null,
        email: validatedData.email,
        password: hashedPassword,
        emailVerified: null, // Not verified yet
        subscriptionTier: 'free',
        creditAllowance: freeTierCredits,
        creditsUsed: 0,
        referredById: referrerId,
        product: validatedData.product ?? null,
      },
    })

    // Create pending referral if valid referral code was provided
    if (referrerId && validatedData.referralCode) {
      await createPendingReferral(
        referrerId,
        user.id,
        validatedData.referralCode,
        'web'
      )
    }

    // Generate verification token
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
    }

    return NextResponse.json(
      {
        message: "Account created successfully. Please check your email to verify your account.",
        userId: user.id,
        emailSent
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      try {
        const parsed = JSON.parse(error.message) as { details?: unknown }
        return NextResponse.json(
          { message: "Invalid input", errors: parsed.details ?? [] },
          { status: 400 }
        )
      } catch {
        return NextResponse.json(
          { message: "Invalid input", errors: [] },
          { status: 400 }
        )
      }
    }

    console.error("Signup error:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

