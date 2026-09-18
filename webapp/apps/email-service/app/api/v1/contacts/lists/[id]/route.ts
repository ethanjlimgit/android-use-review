import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, type ApiKeyContext } from "@/lib/api-key-auth"
import { prisma } from "@/lib/email-prisma"
import { z } from "zod"
import { updateContactListSchema } from "@/lib/schemas"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  const { id } = await params

  try {
    const list = await prisma.contactList.findUnique({
      where: { id, projectId: ctx.project.id },
      include: {
        _count: { select: { memberships: true } },
      },
    })

    if (!list) {
      return NextResponse.json({ error: "Contact list not found" }, { status: 404 })
    }

    return NextResponse.json(list)
  } catch (error) {
    console.error("Error fetching contact list:", error)
    return NextResponse.json({ error: "Failed to fetch contact list" }, { status: 500 })
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
    const data = updateContactListSchema.parse(body)

    const existing = await prisma.contactList.findUnique({
      where: { id, projectId: ctx.project.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Contact list not found" }, { status: 404 })
    }

    const list = await prisma.contactList.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description ?? null }),
      },
    })

    return NextResponse.json(list)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }
    console.error("Error updating contact list:", error)
    return NextResponse.json({ error: "Failed to update contact list" }, { status: 500 })
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
    const existing = await prisma.contactList.findUnique({
      where: { id, projectId: ctx.project.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Contact list not found" }, { status: 404 })
    }

    await prisma.contactList.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting contact list:", error)
    return NextResponse.json({ error: "Failed to delete contact list" }, { status: 500 })
  }
}
