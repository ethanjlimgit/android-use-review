import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/email-prisma"
import { z } from "zod"
import { campaignEmailService } from "@/lib/campaign-email"

const testEmailSchema = z.object({
  email: z.string().email(),
  variant: z.object({
    subject: z.string().min(1),
    preheader: z.string().optional(),
    htmlBody: z.string().min(1),
    textBody: z.string().optional(),
  }),
  senderId: z.string().nullable().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params

  try {
    const body = await request.json()
    const data = testEmailSchema.parse(body)

    let sender = data.senderId
      ? await prisma.senderIdentity.findUnique({ where: { id: data.senderId } })
      : null

    if (!sender) {
      sender = await prisma.senderIdentity.findFirst({
        where: { projectId, isDefault: true },
      })
    }

    if (!sender) {
      return NextResponse.json(
        { error: "No sender identity configured. Create a sender first." },
        { status: 400 }
      )
    }

    const result = await campaignEmailService.sendCampaignEmail({
      to: data.email,
      subject: `[TEST] ${data.variant.subject}`,
      preheader: data.variant.preheader || null,
      htmlBody: data.variant.htmlBody,
      textBody: data.variant.textBody || null,
      recipientId: "test-preview",
      unsubscribeToken: "test-token",
      campaignId: "test",
      variantId: "test",
      fromEmail: sender.email,
      fromName: sender.name,
      replyTo: sender.replyTo,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to send test email" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }
    console.error("Error sending test email:", error)
    return NextResponse.json({ error: "Failed to send test email" }, { status: 500 })
  }
}
