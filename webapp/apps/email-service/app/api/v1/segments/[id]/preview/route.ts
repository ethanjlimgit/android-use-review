import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, type ApiKeyContext } from "@/lib/api-key-auth"
import { prisma } from "@/lib/email-prisma"
import { buildContactWhereFromFilters } from "@/lib/segment-evaluator"

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

    const where = buildContactWhereFromFilters(ctx.project.id, segment.filters as any)

    const [count, sample] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
    ])

    return NextResponse.json({ count, sample })
  } catch (error) {
    console.error("Error previewing segment:", error)
    return NextResponse.json({ error: "Failed to preview segment" }, { status: 500 })
  }
}
