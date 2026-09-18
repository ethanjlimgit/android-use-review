import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, type ApiKeyContext } from "@/lib/api-key-auth"
import { prisma } from "@/lib/email-prisma"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  const { id } = await params

  try {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id, projectId: ctx.project.id },
    })

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    if (campaign.status === "SENT" || campaign.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Campaign is already completed or cancelled" },
        { status: 400 }
      )
    }

    await prisma.$transaction([
      prisma.emailCampaign.update({
        where: { id },
        data: { status: "CANCELLED" },
      }),
      // Remove all queued recipients that haven't been sent yet
      prisma.campaignRecipient.deleteMany({
        where: { campaignId: id, status: "QUEUED" },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error cancelling campaign:", error)
    return NextResponse.json({ error: "Failed to cancel campaign" }, { status: 500 })
  }
}
