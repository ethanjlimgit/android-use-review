import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, type ApiKeyContext } from "@/lib/api-key-auth"
import { prisma } from "@/lib/email-prisma"
import { z } from "zod"
import { updateSenderSchema } from "@/lib/schemas"
import { deleteVerifiedSender } from "@/lib/sendgrid-senders"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  const { id } = await params

  try {
    const sender = await prisma.senderIdentity.findUnique({
      where: { id, projectId: ctx.project.id },
    })

    if (!sender) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 })
    }

    return NextResponse.json(sender)
  } catch (error) {
    console.error("Error fetching sender:", error)
    return NextResponse.json({ error: "Failed to fetch sender" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  const { id } = await params

  try {
    const body = await request.json()
    const data = updateSenderSchema.parse(body)

    const existing = await prisma.senderIdentity.findUnique({
      where: { id, projectId: ctx.project.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 })
    }

    // If setting as default, unset all others first
    if (data.isDefault) {
      await prisma.senderIdentity.updateMany({
        where: { projectId: ctx.project.id, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const sender = await prisma.senderIdentity.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.replyTo !== undefined && { replyTo: data.replyTo ?? null }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    })

    return NextResponse.json(sender)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }
    console.error("Error updating sender:", error)
    return NextResponse.json({ error: "Failed to update sender" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  const { id } = await params

  try {
    const existing = await prisma.senderIdentity.findUnique({
      where: { id, projectId: ctx.project.id },
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

    await prisma.senderIdentity.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting sender:", error)
    return NextResponse.json({ error: "Failed to delete sender" }, { status: 500 })
  }
}
