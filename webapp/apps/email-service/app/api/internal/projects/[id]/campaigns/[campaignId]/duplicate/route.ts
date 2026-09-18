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
    const original = await prisma.emailCampaign.findUnique({
      where: { id: campaignId, projectId },
      include: { variants: { orderBy: { sortOrder: "asc" } } },
    })

    if (!original) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const duplicate = await prisma.emailCampaign.create({
      data: {
        projectId,
        senderId: original.senderId,
        name: `${original.name} (Copy)`,
        status: "DRAFT",
        sendByTimezone: original.sendByTimezone,
        targetHour: original.targetHour,
        variants: {
          create: original.variants.map((v) => ({
            segmentId: v.segmentId,
            subject: v.subject,
            preheader: v.preheader,
            htmlBody: v.htmlBody,
            textBody: v.textBody,
            sortOrder: v.sortOrder,
          })),
        },
      },
      include: { variants: true },
    })

    return NextResponse.json(duplicate, { status: 201 })
  } catch (error) {
    console.error("Error duplicating campaign:", error)
    return NextResponse.json({ error: "Failed to duplicate campaign" }, { status: 500 })
  }
}
