import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, type ApiKeyContext } from "@/lib/api-key-auth"
import { prisma } from "@/lib/email-prisma"
import { z } from "zod"
import { updateSegmentSchema } from "@/lib/schemas"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  const { id } = await params

  try {
    const segment = await prisma.emailSegment.findUnique({
      where: { id, projectId: ctx.project.id },
    })

    if (!segment) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 })
    }

    return NextResponse.json(segment)
  } catch (error) {
    console.error("Error fetching segment:", error)
    return NextResponse.json({ error: "Failed to fetch segment" }, { status: 500 })
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
    const data = updateSegmentSchema.parse(body)

    const existing = await prisma.emailSegment.findUnique({
      where: { id, projectId: ctx.project.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 })
    }

    const segment = await prisma.emailSegment.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description ?? null }),
        ...(data.filters !== undefined && { filters: data.filters as any }),
      },
    })

    return NextResponse.json(segment)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }
    console.error("Error updating segment:", error)
    return NextResponse.json({ error: "Failed to update segment" }, { status: 500 })
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
    const existing = await prisma.emailSegment.findUnique({
      where: { id, projectId: ctx.project.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 })
    }

    await prisma.emailSegment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting segment:", error)
    return NextResponse.json({ error: "Failed to delete segment" }, { status: 500 })
  }
}
