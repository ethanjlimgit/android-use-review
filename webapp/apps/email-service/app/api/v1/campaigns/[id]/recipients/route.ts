import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, type ApiKeyContext } from "@/lib/api-key-auth"
import { prisma } from "@/lib/email-prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  const { id } = await params
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const pageSize = parseInt(searchParams.get("pageSize") || "50")
  const status = searchParams.get("status")

  try {
    // Verify campaign belongs to project
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id, projectId: ctx.project.id },
    })

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const where: Record<string, unknown> = { campaignId: id }
    if (status) where.status = status

    const [recipients, total] = await Promise.all([
      prisma.campaignRecipient.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          variant: { select: { subject: true } },
          events: {
            select: { eventType: true, timestamp: true },
            orderBy: { timestamp: "desc" },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { email: "asc" },
      }),
      prisma.campaignRecipient.count({ where }),
    ])

    return NextResponse.json({
      recipients,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("Error fetching recipients:", error)
    return NextResponse.json({ error: "Failed to fetch recipients" }, { status: 500 })
  }
}
