import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, type ApiKeyContext } from "@/lib/api-key-auth"
import { prisma } from "@/lib/email-prisma"
import { z } from "zod"
import { createCampaignSchema } from "@/lib/schemas"

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status")
    const search = searchParams.get("search")

    const where: Record<string, unknown> = { projectId: ctx.project.id }
    if (status) where.status = status
    if (search) {
      where.name = { contains: search, mode: "insensitive" }
    }

    const campaigns = await prisma.emailCampaign.findMany({
      where,
      include: {
        variants: { select: { id: true, subject: true, segmentId: true } },
        _count: { select: { recipients: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(campaigns)
  } catch (error) {
    console.error("Error fetching campaigns:", error)
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  try {
    const body = await request.json()
    const data = createCampaignSchema.parse(body)

    // Resolve sender: use provided senderId, or fall back to project's default sender
    let senderId = data.senderId ?? null
    if (!senderId) {
      const defaultSender = await prisma.senderIdentity.findFirst({
        where: { projectId: ctx.project.id, isDefault: true },
      })
      if (defaultSender) {
        senderId = defaultSender.id
      }
    }

    const campaign = await prisma.emailCampaign.create({
      data: {
        projectId: ctx.project.id,
        senderId,
        name: data.name,
        scheduledAt: data.scheduledAt ?? null,
        sendByTimezone: data.sendByTimezone ?? false,
        targetHour: data.targetHour ?? null,
        variants: {
          create: data.variants.map((v, i) => ({
            segmentId: v.segmentId ?? null,
            subject: v.subject,
            preheader: v.preheader ?? null,
            htmlBody: v.htmlBody,
            textBody: v.textBody ?? null,
            sortOrder: v.sortOrder ?? i,
          })),
        },
      },
      include: {
        variants: true,
      },
    })

    return NextResponse.json(campaign, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }
    console.error("Error creating campaign:", error)
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
  }
}
