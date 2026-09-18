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

    if (campaign.status !== "SENDING" && campaign.status !== "SCHEDULED") {
      return NextResponse.json(
        { error: "Can only pause campaigns that are SENDING or SCHEDULED" },
        { status: 400 }
      )
    }

    await prisma.emailCampaign.update({
      where: { id },
      data: { status: "PAUSED" },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error pausing campaign:", error)
    return NextResponse.json({ error: "Failed to pause campaign" }, { status: 500 })
  }
}
