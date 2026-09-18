import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, type ApiKeyContext } from "@/lib/api-key-auth"
import { prisma } from "@/lib/email-prisma"
import { z } from "zod"
import { createSenderSchema } from "@/lib/schemas"
import { createVerifiedSender } from "@/lib/sendgrid-senders"

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  try {
    const senders = await prisma.senderIdentity.findMany({
      where: { projectId: ctx.project.id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(senders)
  } catch (error) {
    console.error("Error fetching senders:", error)
    return NextResponse.json({ error: "Failed to fetch senders" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  try {
    const body = await request.json()
    const data = createSenderSchema.parse(body)

    // If this sender should be default, unset all others first
    if (data.isDefault) {
      await prisma.senderIdentity.updateMany({
        where: { projectId: ctx.project.id, isDefault: true },
        data: { isDefault: false },
      })
    }

    const sender = await prisma.senderIdentity.create({
      data: {
        projectId: ctx.project.id,
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
