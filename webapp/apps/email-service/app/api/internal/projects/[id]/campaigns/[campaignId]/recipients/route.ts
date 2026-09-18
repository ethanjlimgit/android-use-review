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
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const pageSize = parseInt(searchParams.get("pageSize") || "50")
  const status = searchParams.get("status")

  try {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId, projectId },
    })

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const where: Record<string, unknown> = { campaignId }
    if (status) where.status = status

    const [recipients, total] = await Promise.all([
      prisma.campaignRecipient.findMany({
        where,
        include: {
          contact: {
            select: { id: true, email: true, firstName: true, lastName: true },
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
