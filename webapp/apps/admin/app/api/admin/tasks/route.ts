import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@droiduse/shared-lib/server"

export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || undefined
    const status = searchParams.get("status") || undefined
    const userId = searchParams.get("userId") || undefined
    const limit = searchParams.get("limit")
    const offset = searchParams.get("offset")

    const where: any = {}

    if (search) {
      where.goal = {
        contains: search,
        mode: "insensitive",
      }
    }

    if (status) {
      where.status = status
    }

    if (userId) {
      where.userId = userId
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        select: {
          id: true,
          goal: true,
          userId: true,
          status: true,
          totalSteps: true,
          isReplay: true,
          replaySourceId: true,
          createdAt: true,
          completedAt: true,
          error: true,
          device: {
            select: {
              id: true,
              name: true,
              deviceId: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              taskSteps: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit ? parseInt(limit) : undefined,
        skip: offset ? parseInt(offset) : undefined,
      }),
      prisma.task.count({ where }),
    ])

    return NextResponse.json({ tasks, total })
  } catch (error) {
    console.error("[ADMIN_TASKS_GET]", error)
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    )
  }
}
