import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/email-prisma"
import { z } from "zod"
import { createContactListSchema } from "@/lib/schemas"

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
    const lists = await prisma.contactList.findMany({
      where: { projectId },
      include: {
        _count: { select: { memberships: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(lists)
  } catch (error) {
    console.error("Error fetching contact lists:", error)
    return NextResponse.json({ error: "Failed to fetch contact lists" }, { status: 500 })
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
    const data = createContactListSchema.parse(body)

    const list = await prisma.contactList.create({
      data: {
        projectId,
        name: data.name,
        description: data.description ?? null,
      },
    })

    return NextResponse.json(list, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }
    console.error("Error creating contact list:", error)
    return NextResponse.json({ error: "Failed to create contact list" }, { status: 500 })
  }
}
