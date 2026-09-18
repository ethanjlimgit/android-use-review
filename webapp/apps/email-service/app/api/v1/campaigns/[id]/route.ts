import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, type ApiKeyContext } from "@/lib/api-key-auth"
import { prisma } from "@/lib/email-prisma"
import { z } from "zod"
import { updateCampaignSchema } from "@/lib/schemas"

export async function GET(
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

    // Aggregate stats
    const stats = await prisma.campaignRecipient.groupBy({
      by: ["status"],
      where: { campaignId: id },
      _count: true,
    })

    const eventCounts = await prisma.emailEvent.groupBy({
      by: ["eventType"],
      where: { recipient: { campaignId: id } },
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  const { id } = await params

  try {
    const body = await request.json()
    const data = updateCampaignSchema.parse(body)

    const existing = await prisma.emailCampaign.findUnique({
      where: { id, projectId: ctx.project.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json({ error: "Can only edit campaigns in DRAFT status" }, { status: 400 })
    }

    const campaign = await prisma.$transaction(async (tx) => {
      const updated = await tx.emailCampaign.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.senderId !== undefined && { senderId: data.senderId ?? null }),
          ...(data.scheduledAt !== undefined && { scheduledAt: data.scheduledAt ?? null }),
          ...(data.sendByTimezone !== undefined && { sendByTimezone: data.sendByTimezone }),
          ...(data.targetHour !== undefined && { targetHour: data.targetHour ?? null }),
        },
      })

      if (data.variants) {
        await tx.campaignVariant.deleteMany({ where: { campaignId: id } })
        await tx.campaignVariant.createMany({
          data: data.variants.map((v, i) => ({
            campaignId: id,
            segmentId: v.segmentId ?? null,
            subject: v.subject,
            preheader: v.preheader ?? null,
            htmlBody: v.htmlBody,
            textBody: v.textBody ?? null,
            sortOrder: v.sortOrder ?? i,
          })),
        })
      }

      return tx.emailCampaign.findUnique({
        where: { id },
        include: { variants: { orderBy: { sortOrder: "asc" } } },
      })
    })

    return NextResponse.json(campaign)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }
    console.error("Error updating campaign:", error)
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  const { id } = await params

  try {
    const existing = await prisma.emailCampaign.findUnique({
      where: { id, projectId: ctx.project.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    await prisma.emailCampaign.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting campaign:", error)
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 })
  }
}
