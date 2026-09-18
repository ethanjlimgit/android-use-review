import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/email-prisma"
import crypto from "crypto"

const EVENT_TYPE_MAP: Record<string, string> = {
  delivered: "DELIVERED",
  open: "OPENED",
  click: "CLICKED",
  bounce: "BOUNCED",
  dropped: "DROPPED",
  spamreport: "SPAM_REPORT",
  unsubscribe: "UNSUBSCRIBE",
}

export async function POST(request: NextRequest) {
  try {
    // Verify SendGrid webhook signature
    const verificationKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY
    if (verificationKey) {
      const signature = request.headers.get(
        "x-twilio-email-event-webhook-signature"
      )
      const timestamp = request.headers.get(
        "x-twilio-email-event-webhook-timestamp"
      )

      if (!signature || !timestamp) {
        return NextResponse.json(
          { error: "Missing signature" },
          { status: 401 }
        )
      }

      const body = await request.text()
      const payload = timestamp + body

      const publicKey = crypto.createPublicKey({
        key: Buffer.from(verificationKey, "base64"),
        format: "der",
        type: "spki",
      })

      const isValid = crypto.verify(
        "sha256",
        Buffer.from(payload),
        publicKey,
        Buffer.from(signature, "base64")
      )

      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        )
      }

      // Parse the body since we already consumed it
      const events = JSON.parse(body)
      await processEvents(events)
    } else {
      // No verification key configured - parse directly
      const events = await request.json()
      await processEvents(events)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[sendgrid-webhook] Error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

async function processEvents(events: any[]) {
  for (const event of events) {
    const eventType = EVENT_TYPE_MAP[event.event]
    if (!eventType) continue

    // Look up recipient by custom_args.recipientId or sg_message_id
    const sgMessageId = event.sg_message_id?.split(".")[0]
    const recipientId = event.recipientId // From custom_args

    let recipient = null

    if (recipientId) {
      recipient = await prisma.campaignRecipient.findUnique({
        where: { id: recipientId },
      })
    }

    if (!recipient && sgMessageId) {
      recipient = await prisma.campaignRecipient.findFirst({
        where: { sendgridMessageId: sgMessageId },
      })
    }

    if (!recipient) continue

    try {
      await prisma.emailEvent.create({
        data: {
          recipientId: recipient.id,
          eventType: eventType as any,
          url: event.url || null,
          userAgent: event.useragent || null,
          ip: event.ip || null,
          sendgridEventId: event.sg_event_id || null,
          timestamp: event.timestamp
            ? new Date(event.timestamp * 1000)
            : new Date(),
          rawPayload: event,
        },
      })

      // Update recipient status for delivery events
      if (eventType === "DELIVERED") {
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "DELIVERED" },
        })
      } else if (eventType === "BOUNCED") {
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "FAILED", error: event.reason || "Bounced" },
        })
      }

      // Auto-unsubscribe Contact on spam report or unsubscribe event
      if (eventType === "SPAM_REPORT" || eventType === "UNSUBSCRIBE") {
        await prisma.contact.update({
          where: { id: recipient.contactId },
          data: {
            emailUnsubscribed: true,
            emailUnsubscribedAt: new Date(),
          },
        })
      }
    } catch (error) {
      // Skip duplicate events (unique constraint on sendgridEventId)
      if ((error as any)?.code === "P2002") continue
      console.error("[sendgrid-webhook] Failed to process event:", error)
    }
  }
}
