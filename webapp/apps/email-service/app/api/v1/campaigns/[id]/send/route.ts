import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, type ApiKeyContext } from "@/lib/api-key-auth"
import { prisma } from "@/lib/email-prisma"
import { buildContactWhereFromFilters } from "@/lib/segment-evaluator"
import { calculateSendTimeForTimezone, getTimezoneFromCountry } from "@/lib/timezone"
import { campaignEmailService } from "@/lib/campaign-email"
import crypto from "crypto"

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
      include: {
        variants: {
          include: { segment: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
      return NextResponse.json(
        { error: "Campaign must be in DRAFT or SCHEDULED status to send" },
        { status: 400 }
      )
    }

    // Get sender identity
    let sender = campaign.senderId
      ? await prisma.senderIdentity.findUnique({ where: { id: campaign.senderId } })
      : null

    if (!sender) {
      sender = await prisma.senderIdentity.findFirst({
        where: { projectId: ctx.project.id, isDefault: true },
      })
    }

    if (!sender) {
      return NextResponse.json(
        { error: "No sender identity configured. Create a sender first." },
        { status: 400 }
      )
    }

    if (!sender.verified) {
      return NextResponse.json(
        { error: "Sender is not verified. Please verify the sender email address before sending campaigns." },
        { status: 400 }
      )
    }

    // Evaluate segments and assign contacts to variants
    const assignedContactIds = new Set<string>()
    const recipientData: Array<{
      contactId: string
      email: string
      variantId: string
      timezone: string | null
      scheduledFor: Date | null
    }> = []

    // Process variants with segments first, then the default (segmentId=null) variant
    const segmentedVariants = campaign.variants.filter((v) => v.segmentId !== null)
    const defaultVariant = campaign.variants.find((v) => v.segmentId === null)

    for (const variant of segmentedVariants) {
      if (!variant.segment) continue

      const where = buildContactWhereFromFilters(
        ctx.project.id,
        variant.segment.filters as any
      )

      const contacts = await prisma.contact.findMany({
        where,
        select: {
          id: true,
          email: true,
          timezone: true,
          country: true,
          city: true,
        },
      })

      for (const contact of contacts) {
        if (assignedContactIds.has(contact.id)) continue
        assignedContactIds.add(contact.id)

        const tz = contact.timezone || getTimezoneFromCountry(
          contact.country || "",
          contact.city
        )

        let scheduledFor: Date | null = null
        if (campaign.sendByTimezone && campaign.targetHour !== null && tz) {
          scheduledFor = calculateSendTimeForTimezone(campaign.targetHour, tz)
        }

        recipientData.push({
          contactId: contact.id,
          email: contact.email,
          variantId: variant.id,
          timezone: tz,
          scheduledFor,
        })
      }
    }

    // Default variant gets all remaining eligible contacts
    if (defaultVariant) {
      const baseWhere = {
        projectId: ctx.project.id,
        emailUnsubscribed: false,
        id: { notIn: Array.from(assignedContactIds) },
      }

      const contacts = await prisma.contact.findMany({
        where: baseWhere,
        select: {
          id: true,
          email: true,
          timezone: true,
          country: true,
          city: true,
        },
      })

      for (const contact of contacts) {
        assignedContactIds.add(contact.id)

        const tz = contact.timezone || getTimezoneFromCountry(
          contact.country || "",
          contact.city
        )

        let scheduledFor: Date | null = null
        if (campaign.sendByTimezone && campaign.targetHour !== null && tz) {
          scheduledFor = calculateSendTimeForTimezone(campaign.targetHour, tz)
        }

        recipientData.push({
          contactId: contact.id,
          email: contact.email,
          variantId: defaultVariant.id,
          timezone: tz,
          scheduledFor,
        })
      }
    }

    if (recipientData.length === 0) {
      return NextResponse.json({ error: "No eligible recipients found" }, { status: 400 })
    }

    // Ensure all contacts have unsubscribe tokens
    const contactIdsNeedingTokens = recipientData.map((r) => r.contactId)
    const contactsWithoutTokens = await prisma.contact.findMany({
      where: { id: { in: contactIdsNeedingTokens }, unsubscribeToken: null },
      select: { id: true },
    })

    if (contactsWithoutTokens.length > 0) {
      await Promise.all(
        contactsWithoutTokens.map((c) =>
          prisma.contact.update({
            where: { id: c.id },
            data: { unsubscribeToken: crypto.randomUUID() },
          })
        )
      )
    }

    // Create recipient records
    await prisma.campaignRecipient.createMany({
      data: recipientData.map((r) => ({
        campaignId: id,
        variantId: r.variantId,
        contactId: r.contactId,
        email: r.email,
        timezone: r.timezone,
        scheduledFor: r.scheduledFor,
        status: "QUEUED",
      })),
      skipDuplicates: true,
    })

    // Update campaign status
    await prisma.emailCampaign.update({
      where: { id },
      data: {
        status: campaign.sendByTimezone ? "SCHEDULED" : "SENDING",
      },
    })

    // If not timezone-based, start sending immediately
    if (!campaign.sendByTimezone) {
      sendCampaignEmails(id, sender).catch((err) =>
        console.error(`[campaign] Background send failed for ${id}:`, err)
      )
    }

    return NextResponse.json({
      success: true,
      recipientCount: recipientData.length,
      status: campaign.sendByTimezone ? "SCHEDULED" : "SENDING",
    })
  } catch (error) {
    console.error("Error sending campaign:", error)
    return NextResponse.json({ error: "Failed to send campaign" }, { status: 500 })
  }
}

async function sendCampaignEmails(
  campaignId: string,
  sender: { email: string; name: string; replyTo: string | null }
) {
  const recipients = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: "QUEUED" },
    include: {
      variant: true,
      contact: { select: { unsubscribeToken: true } },
    },
  })

  const campaign = { id: campaignId }

  // Group by variant for batch sending
  const byVariant = new Map<string, typeof recipients>()
  for (const r of recipients) {
    const group = byVariant.get(r.variantId) || []
    group.push(r)
    byVariant.set(r.variantId, group)
  }

  for (const [, variantRecipients] of byVariant) {
    if (variantRecipients.length === 0) continue
    const variant = variantRecipients[0].variant

    const results = await campaignEmailService.sendBatch(
      variantRecipients.map((r) => ({
        to: r.email,
        recipientId: r.id,
        unsubscribeToken: r.contact.unsubscribeToken || "",
      })),
      variant,
      campaign,
      sender
    )

    // Update recipient statuses
    for (const result of results) {
      if (!result.recipientId) continue
      await prisma.campaignRecipient.update({
        where: { id: result.recipientId },
        data: {
          status: result.success ? "SENT" : "FAILED",
          sentAt: result.success ? new Date() : null,
          sendgridMessageId: result.messageId || null,
          error: result.error || null,
        },
      })
    }
  }

  // Mark campaign as SENT
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { status: "SENT" },
  })
}
