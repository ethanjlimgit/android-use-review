import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, type ApiKeyContext } from "@/lib/api-key-auth"
import { prisma } from "@/lib/email-prisma"
import { z } from "zod"
import { addListMembersSchema } from "@/lib/schemas"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  const { id } = await params
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const pageSize = parseInt(searchParams.get("pageSize") || "50")

  try {
    const list = await prisma.contactList.findUnique({
      where: { id, projectId: ctx.project.id },
    })

    if (!list) {
      return NextResponse.json({ error: "Contact list not found" }, { status: 404 })
    }

    const where = { listId: id }

    const [members, total] = await Promise.all([
      prisma.contactListMembership.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              createdAt: true,
            },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.contactListMembership.count({ where }),
    ])

    return NextResponse.json({
      members,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("Error fetching list members:", error)
    return NextResponse.json({ error: "Failed to fetch list members" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  const { id } = await params

  try {
    const body = await request.json()
    const data = addListMembersSchema.parse(body)

    const list = await prisma.contactList.findUnique({
      where: { id, projectId: ctx.project.id },
    })

    if (!list) {
      return NextResponse.json({ error: "Contact list not found" }, { status: 404 })
    }

    const result = await prisma.contactListMembership.createMany({
      data: data.contactIds.map((contactId) => ({
        contactId,
        listId: id,
      })),
      skipDuplicates: true,
    })

    return NextResponse.json({ added: result.count }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }
    console.error("Error adding list members:", error)
    return NextResponse.json({ error: "Failed to add list members" }, { status: 500 })
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
    const body = await request.json()
    const { contactIds } = z.object({ contactIds: z.array(z.string()).min(1) }).parse(body)

    const list = await prisma.contactList.findUnique({
      where: { id, projectId: ctx.project.id },
    })

    if (!list) {
      return NextResponse.json({ error: "Contact list not found" }, { status: 404 })
    }

    const result = await prisma.contactListMembership.deleteMany({
      where: {
        listId: id,
        contactId: { in: contactIds },
      },
    })

    return NextResponse.json({ removed: result.count })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }
    console.error("Error removing list members:", error)
    return NextResponse.json({ error: "Failed to remove list members" }, { status: 500 })
  }
}
