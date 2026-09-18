import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/email-prisma"
import { campaignEmailService } from "@/lib/campaign-email"

export async function POST(request: NextRequest) {
  // Auth via cron secret header
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[process] CRON_SECRET not configured")
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    )
  }

  const providedSecret = request.headers.get("x-cron-secret")
  if (providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Find queued recipients where scheduledFor <= now, from non-paused/cancelled campaigns
    const recipients = await prisma.campaignRecipient.findMany({
      where: {
        status: "QUEUED",
        scheduledFor: { lte: new Date() },
        campaign: {
          status: { notIn: ["PAUSED", "CANCELLED"] },
        },
      },
      include: {
        variant: true,
        contact: {
          select: {
            id: true,
            email: true,
            unsubscribeToken: true,
          },
        },
        campaign: {
          include: {
            sender: true,
            project: {
              include: {
                senderIdentities: {
                  where: { isDefault: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
      take: 500,
    })

    if (recipients.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    // Group recipients by variant
    const byVariant = new Map<
      string,
      typeof recipients
    >()
    for (const recipient of recipients) {
      const key = recipient.variantId
      if (!byVariant.has(key)) {
        byVariant.set(key, [])
      }
      byVariant.get(key)!.push(recipient)
    }

    let totalProcessed = 0
    let totalFailed = 0

    for (const [, variantRecipients] of byVariant) {
      const first = variantRecipients[0]
      const variant = first.variant
      const campaign = first.campaign

      // Determine sender: campaign's sender, or project's default sender
      const sender = campaign.sender ||
        campaign.project.senderIdentities[0]

      if (!sender) {
        console.error(
          `[process] No sender identity for campaign ${campaign.id}`
        )
        // Mark these as failed
        await prisma.campaignRecipient.updateMany({
          where: {
            id: { in: variantRecipients.map((r) => r.id) },
          },
          data: {
            status: "FAILED",
            error: "No sender identity configured",
          },
        })
        totalFailed += variantRecipients.length
        continue
      }

      const batchRecipients = variantRecipients.map((r) => ({
        to: r.contact.email,
        recipientId: r.id,
        unsubscribeToken: r.contact.unsubscribeToken || "",
      }))

      const results = await campaignEmailService.sendBatch(
        batchRecipients,
        {
          subject: variant.subject,
          preheader: variant.preheader,
          htmlBody: variant.htmlBody,
          textBody: variant.textBody,
          id: variant.id,
        },
        { id: campaign.id },
        {
          email: sender.email,
          name: sender.name,
          replyTo: sender.replyTo,
        }
      )

      // Update recipient statuses based on send results
      for (const result of results) {
        if (result.success) {
          await prisma.campaignRecipient.update({
            where: { id: result.recipientId },
            data: {
              status: "SENT",
              sentAt: new Date(),
              sendgridMessageId: result.messageId || null,
            },
          })
          totalProcessed++
        } else {
          await prisma.campaignRecipient.update({
            where: { id: result.recipientId },
            data: {
              status: "FAILED",
              error: result.error || "Send failed",
            },
          })
          totalFailed++
        }
      }
    }

    // Mark campaigns as SENT if no more QUEUED recipients remain
    const campaignIds = [
      ...new Set(recipients.map((r) => r.campaignId)),
    ]
    for (const campaignId of campaignIds) {
      const remainingQueued = await prisma.campaignRecipient.count({
        where: {
          campaignId,
          status: "QUEUED",
        },
      })

      if (remainingQueued === 0) {
        await prisma.emailCampaign.update({
          where: { id: campaignId },
          data: { status: "SENT" },
        })
      }
    }

    return NextResponse.json({
      processed: totalProcessed,
      failed: totalFailed,
      campaignsChecked: campaignIds.length,
    })
  } catch (error) {
    console.error("[process] Error processing campaigns:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
