import { NextRequest, NextResponse } from "next/server"
import { prisma, completeReferral } from "@droiduse/shared-lib/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { message: "Verification token is required" },
        { status: 400 }
      )
    }

    // Find the verification token
    const verificationToken = await prisma.userToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!verificationToken || verificationToken.type !== 'EMAIL_VERIFICATION') {
      return NextResponse.json(
        { message: "Invalid or expired verification token" },
        { status: 400 }
      )
    }

    // Check if token has already been used
    if (verificationToken.usedAt) {
      return NextResponse.json(
        { message: "This verification link has already been used" },
        { status: 400 }
      )
    }

    // Check if token has expired
    if (new Date() > verificationToken.expiresAt) {
      return NextResponse.json(
        { message: "This verification link has expired. Please request a new one." },
        { status: 400 }
      )
    }

    // Verify the user's email
    await prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: new Date() },
    })

    // Mark token as used
    await prisma.userToken.update({
      where: { token },
      data: { usedAt: new Date() },
    })

    // Complete referral if user was referred (awards credits to referrer)
    const referralCompleted = await completeReferral(verificationToken.userId)
    if (referralCompleted) {
      console.log(`Referral completed for user ${verificationToken.userId}`)
    }

    return NextResponse.json(
      {
        message: "Email verified successfully! You can now sign in.",
        success: true,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Email verification error:", error)
    return NextResponse.json(
      { message: "Failed to verify email" },
      { status: 500 }
    )
  }
}
