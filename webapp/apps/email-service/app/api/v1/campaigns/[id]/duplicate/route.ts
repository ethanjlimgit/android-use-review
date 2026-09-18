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
    const original = await prisma.emailCampaign.findUnique({
      where: { id, projectId: ctx.project.id },
      include: { variants: { orderBy: { sortOrder: "asc" } } },
    })

    if (!original) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const duplicate = await prisma.emailCampaign.create({
      data: {
        projectId: ctx.project.id,
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
