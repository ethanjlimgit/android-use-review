import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/email-prisma"
import { z } from "zod"
import { createSenderSchema } from "@/lib/schemas"
import { createVerifiedSender, deleteVerifiedSender, listVerifiedSenders } from "@/lib/sendgrid-senders"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params

  try {
    const senders = await prisma.senderIdentity.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    })

    // Fire-and-forget: sync verification status from SendGrid
    syncSenderVerificationStatus(senders).catch((err) =>
      console.error("Background sender verification sync failed:", err)
    )

    return NextResponse.json(senders)
  } catch (error) {
    console.error("Error fetching senders:", error)
    return NextResponse.json({ error: "Failed to fetch senders" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params

  try {
    const body = await request.json()
    const data = createSenderSchema.parse(body)

    if (data.isDefault) {
      await prisma.senderIdentity.updateMany({
        where: { projectId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const sender = await prisma.senderIdentity.create({
      data: {
        projectId,
        name: data.name,
        email: data.email,
        replyTo: data.replyTo ?? null,
        isDefault: data.isDefault ?? false,
        address: data.address,
        city: data.city,
        country: data.country,
      },
    })

    // Register with SendGrid (best-effort)
    try {
      const sgSender = await createVerifiedSender({
        nickname: data.name,
        from_email: data.email,
        from_name: data.name,
        reply_to: data.replyTo ?? data.email,
        reply_to_name: data.name,
        address: data.address,
        city: data.city,
        country: data.country,
      })

      await prisma.senderIdentity.update({
        where: { id: sender.id },
        data: { sendgridSenderId: sgSender.id },
      })

      sender.sendgridSenderId = sgSender.id
    } catch (sgError) {
      console.error("SendGrid registration failed (sender created locally):", sgError)
    }

    return NextResponse.json(sender, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }
    console.error("Error creating sender:", error)
    return NextResponse.json({ error: "Failed to create sender" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params
  const { searchParams } = new URL(request.url)
  const senderId = searchParams.get("senderId")

  if (!senderId) {
    return NextResponse.json({ error: "senderId query parameter is required" }, { status: 400 })
  }

  try {
    const existing = await prisma.senderIdentity.findFirst({
      where: { id: senderId, projectId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 })
    }

    // Delete from SendGrid (best-effort)
    if (existing.sendgridSenderId) {
      try {
        await deleteVerifiedSender(existing.sendgridSenderId)
      } catch (sgError) {
        console.error("SendGrid delete failed (proceeding with local delete):", sgError)
      }
    }

    await prisma.senderIdentity.delete({ where: { id: senderId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting sender:", error)
    return NextResponse.json({ error: "Failed to delete sender" }, { status: 500 })
  }
}

// Background sync: update local verified status from SendGrid
async function syncSenderVerificationStatus(
  senders: Array<{ id: string; sendgridSenderId: number | null; verified: boolean }>
) {
  const sendersWithSgId = senders.filter((s) => s.sendgridSenderId !== null)
  if (sendersWithSgId.length === 0) return

  const sgSenders = await listVerifiedSenders()
  const sgMap = new Map(sgSenders.map((s) => [s.id, s.verified]))

  for (const sender of sendersWithSgId) {
    const sgVerified = sgMap.get(sender.sendgridSenderId!)
    if (sgVerified !== undefined && sgVerified !== sender.verified) {
      await prisma.senderIdentity.update({
        where: { id: sender.id },
        data: { verified: sgVerified },
      })
    }
  }
}
