import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, type ApiKeyContext } from "@/lib/api-key-auth"
import { prisma } from "@/lib/email-prisma"
import { z } from "zod"
import { sendTestEmailSchema } from "@/lib/schemas"
import { campaignEmailService } from "@/lib/campaign-email"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  const { id } = await params

  try {
    const body = await request.json()
    const data = sendTestEmailSchema.parse(body)

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id, projectId: ctx.project.id },
      include: { variants: { orderBy: { sortOrder: "asc" } } },
    })

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const variantIndex = data.variantIndex ?? 0
    const variant = campaign.variants[variantIndex]
    if (!variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 })
    }

    // Get sender identity
    let sender = campaign.senderId
      ? await prisma.senderIdentity.findUnique({ where: { id: campaign.senderId } })
      : null

    if (!sender) {
      sender = await prisma.senderIdentity.findFirst({
        where: { projectId: ctx.project.id, isDefault: true },
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
      subject: `[TEST] ${variant.subject}`,
      preheader: variant.preheader,
      htmlBody: variant.htmlBody,
      textBody: variant.textBody,
      recipientId: "test-preview",
      unsubscribeToken: "test-token",
      campaignId: campaign.id,
      variantId: variant.id,
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
