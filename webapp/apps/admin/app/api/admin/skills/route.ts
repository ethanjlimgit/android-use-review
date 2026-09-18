import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@droiduse/shared-lib/server"

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search")
    const type = searchParams.get("type")
    const featured = searchParams.get("featured")
    const limit = searchParams.get("limit")
    const offset = searchParams.get("offset")

    const where: any = {}

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    if (type) {
      where.type = type
    }

    if (featured === "true" || featured === "false") {
      where.featured = featured === "true"
    }

    const [skills, total] = await Promise.all([
      prisma.skill.findMany({
        where,
        include: { app: true },
        orderBy: { score: "desc" },
        take: limit ? parseInt(limit) : undefined,
        skip: offset ? parseInt(offset) : undefined,
      }),
      prisma.skill.count({ where }),
    ])

    return NextResponse.json({ skills, total })
  } catch (error) {
    console.error("Error fetching skills:", error)
    return NextResponse.json(
      { error: "Failed to fetch skills" },
      { status: 500 }
    )
  }
}
