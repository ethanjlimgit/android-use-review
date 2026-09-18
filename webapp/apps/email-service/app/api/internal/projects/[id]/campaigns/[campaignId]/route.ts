import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/email-prisma"

export async function GET(
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
      include: {
        variants: {
          include: { segment: { select: { id: true, name: true } } },
          orderBy: { sortOrder: "asc" },
        },
        createdBy: { select: { name: true, email: true } },
        _count: { select: { recipients: true } },
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const stats = await prisma.campaignRecipient.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: true,
    })

    const eventCounts = await prisma.emailEvent.groupBy({
      by: ["eventType"],
      where: { recipient: { campaignId } },
      _count: true,
    })

    return NextResponse.json({
      ...campaign,
      stats: stats.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      eventCounts: eventCounts.reduce((acc, e) => ({ ...acc, [e.eventType]: e._count }), {}),
    })
  } catch (error) {
    console.error("Error fetching campaign:", error)
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 })
  }
}
