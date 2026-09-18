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

  try {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id, projectId: ctx.project.id },
    })

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Recipient status breakdown
    const recipientStats = await prisma.campaignRecipient.groupBy({
      by: ["status"],
      where: { campaignId: id },
      _count: true,
    })

    // Event type breakdown
    const eventStats = await prisma.emailEvent.groupBy({
      by: ["eventType"],
      where: { recipient: { campaignId: id } },
      _count: true,
    })

    // Per-variant stats
    const variantStats = await prisma.campaignVariant.findMany({
      where: { campaignId: id },
      include: {
        segment: { select: { name: true } },
        _count: { select: { recipients: true } },
      },
    })

    const variantEventStats = await Promise.all(
      variantStats.map(async (v) => {
        const events = await prisma.emailEvent.groupBy({
          by: ["eventType"],
          where: { recipient: { variantId: v.id } },
          _count: true,
        })
        return {
          variantId: v.id,
          subject: v.subject,
          segmentName: v.segment?.name || "All remaining",
          recipientCount: v._count.recipients,
          events: events.reduce((acc, e) => ({ ...acc, [e.eventType]: e._count }), {}),
        }
      })
    )

    // Events over time (grouped by day)
    const eventsOverTime = await prisma.$queryRawUnsafe<
      Array<{ date: string; event_type: string; count: bigint }>
    >(
      `SELECT DATE(timestamp) as date, event_type, COUNT(*) as count
       FROM email_marketing.email_events
       WHERE recipient_id IN (SELECT id FROM email_marketing.campaign_recipients WHERE campaign_id = $1)
       GROUP BY DATE(timestamp), event_type
       ORDER BY date ASC`,
      id
    )

    const totalRecipients = recipientStats.reduce((sum, s) => sum + s._count, 0)
    const eventMap = eventStats.reduce(
      (acc, e) => ({ ...acc, [e.eventType]: e._count }),
      {} as Record<string, number>
    )

    return NextResponse.json({
      totalRecipients,
      recipientsByStatus: recipientStats.reduce(
        (acc, s) => ({ ...acc, [s.status]: s._count }),
        {} as Record<string, number>
      ),
      delivered: eventMap.DELIVERED || 0,
      opened: eventMap.OPENED || 0,
      clicked: eventMap.CLICKED || 0,
      bounced: eventMap.BOUNCED || 0,
      spamReports: eventMap.SPAM_REPORT || 0,
      openRate: totalRecipients > 0 ? ((eventMap.OPENED || 0) / totalRecipients) * 100 : 0,
      clickRate: totalRecipients > 0 ? ((eventMap.CLICKED || 0) / totalRecipients) * 100 : 0,
      bounceRate: totalRecipients > 0 ? ((eventMap.BOUNCED || 0) / totalRecipients) * 100 : 0,
      variantStats: variantEventStats,
      eventsOverTime: eventsOverTime.map((e) => ({
        date: e.date,
        eventType: e.event_type,
        count: Number(e.count),
      })),
    })
  } catch (error) {
    console.error("Error fetching campaign stats:", error)
    return NextResponse.json({ error: "Failed to fetch campaign stats" }, { status: 500 })
  }
}
