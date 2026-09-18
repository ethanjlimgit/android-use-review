import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/email-prisma"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; campaignId: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId, campaignId } = await params

  try {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId, projectId },
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
        where: { id: campaignId },
        data: { status: "CANCELLED" },
      }),
      prisma.campaignRecipient.deleteMany({
        where: { campaignId, status: "QUEUED" },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error cancelling campaign:", error)
    return NextResponse.json({ error: "Failed to cancel campaign" }, { status: 500 })
  }
}
