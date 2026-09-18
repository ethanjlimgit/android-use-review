import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@droiduse/shared-lib/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        device: {
          include: {
            deviceType: {
              select: {
                widthPixels: true,
                heightPixels: true,
                manufacturer: true,
                model: true,
              },
            },
          },
        },
        taskSteps: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error("[ADMIN_TASK_GET]", error)
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    )
  }
}
