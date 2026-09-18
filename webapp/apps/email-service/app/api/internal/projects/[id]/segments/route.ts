import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/email-prisma"
import { z } from "zod"
import { createSegmentSchema } from "@/lib/schemas"

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
    const segments = await prisma.emailSegment.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(segments)
  } catch (error) {
    console.error("Error fetching segments:", error)
    return NextResponse.json({ error: "Failed to fetch segments" }, { status: 500 })
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
    const data = createSegmentSchema.parse(body)

    const segment = await prisma.emailSegment.create({
      data: {
        projectId,
        name: data.name,
        description: data.description ?? null,
        filters: data.filters as any,
      },
    })

    return NextResponse.json(segment, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }
    console.error("Error creating segment:", error)
    return NextResponse.json({ error: "Failed to create segment" }, { status: 500 })
  }
}
