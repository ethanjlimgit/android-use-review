import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/email-prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const pageSize = parseInt(searchParams.get("pageSize") || "50")
  const search = searchParams.get("search")
  const listId = searchParams.get("listId")

  try {
    const where: Record<string, unknown> = { projectId }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
      ]
    }

    if (listId) {
      where.listMemberships = { some: { listId } }
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.contact.count({ where }),
    ])

    return NextResponse.json({
      contacts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("Error fetching contacts:", error)
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 })
  }
}
