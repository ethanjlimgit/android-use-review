import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/email-prisma"
import { getVerificationStatus, resendVerification } from "@/lib/sendgrid-senders"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; senderId: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId, senderId } = await params

  try {
    const sender = await prisma.senderIdentity.findFirst({
      where: { id: senderId, projectId },
    })

    if (!sender) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 })
    }

    if (!sender.sendgridSenderId) {
      return NextResponse.json({ verified: sender.verified, sendgridSenderId: null })
    }

    const verified = await getVerificationStatus(sender.sendgridSenderId)

    if (verified !== sender.verified) {
      await prisma.senderIdentity.update({
        where: { id: senderId },
        data: { verified },
      })
    }

    return NextResponse.json({ verified, sendgridSenderId: sender.sendgridSenderId })
  } catch (error) {
    console.error("Error checking verification status:", error)
    return NextResponse.json({ error: "Failed to check verification status" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; senderId: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId, senderId } = await params

  try {
    const sender = await prisma.senderIdentity.findFirst({
      where: { id: senderId, projectId },
    })

    if (!sender) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 })
    }

    if (!sender.sendgridSenderId) {
      return NextResponse.json(
        { error: "Sender is not registered with SendGrid. Cannot resend verification." },
        { status: 400 }
      )
    }

    if (sender.verified) {
      return NextResponse.json({ message: "Sender is already verified" })
    }

    await resendVerification(sender.sendgridSenderId)

    return NextResponse.json({ message: "Verification email resent" })
  } catch (error) {
    console.error("Error resending verification:", error)
    return NextResponse.json({ error: "Failed to resend verification email" }, { status: 500 })
  }
}
