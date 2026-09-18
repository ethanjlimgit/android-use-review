import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, type ApiKeyContext } from "@/lib/api-key-auth"
import { prisma } from "@/lib/email-prisma"
import { z } from "zod"
import { updateContactSchema } from "@/lib/schemas"
import type { Prisma } from "@/generated/client"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  const { id } = await params

  try {
    const contact = await prisma.contact.findUnique({
      where: { id, projectId: ctx.project.id },
      include: {
        listMemberships: {
          include: { list: { select: { id: true, name: true } } },
        },
      },
    })

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    return NextResponse.json(contact)
  } catch (error) {
    console.error("Error fetching contact:", error)
    return NextResponse.json({ error: "Failed to fetch contact" }, { status: 500 })
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
    const data = updateContactSchema.parse(body)

    const existing = await prisma.contact.findUnique({
      where: { id, projectId: ctx.project.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...(data.email !== undefined && { email: data.email }),
        ...(data.firstName !== undefined && { firstName: data.firstName ?? null }),
        ...(data.lastName !== undefined && { lastName: data.lastName ?? null }),
        ...(data.externalId !== undefined && { externalId: data.externalId ?? null }),
        ...(data.phone !== undefined && { phone: data.phone ?? null }),
        ...(data.company !== undefined && { company: data.company ?? null }),
        ...(data.jobTitle !== undefined && { jobTitle: data.jobTitle ?? null }),
        ...(data.timezone !== undefined && { timezone: data.timezone ?? null }),
        ...(data.country !== undefined && { country: data.country ?? null }),
        ...(data.city !== undefined && { city: data.city ?? null }),
        ...(data.metadata !== undefined && { metadata: (data.metadata ?? {}) as Prisma.InputJsonValue }),
        ...(data.source !== undefined && { source: data.source ?? null }),
      },
    })

    return NextResponse.json(contact)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }
    console.error("Error updating contact:", error)
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 })
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
    const existing = await prisma.contact.findUnique({
      where: { id, projectId: ctx.project.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    await prisma.contact.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting contact:", error)
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 })
  }
}
