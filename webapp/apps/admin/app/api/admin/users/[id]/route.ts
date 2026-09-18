import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@droiduse/shared-lib/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        memories: {
          orderBy: {
            createdAt: "desc",
          },
        },
        _count: {
          select: {
            tasks: true,
            skillEntries: true,
            accounts: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Fetch devices separately (devices don't have userId relation in current schema)
    // We'll fetch all devices for now - you may need to adjust this based on your schema
    const devices = await prisma.device.findMany({
      where: {
        userId: id,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ user, devices })
  } catch (error) {
    console.error("[ADMIN_USER_GET]", error)
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Prevent admin from deleting themselves
    if (session.user.id === id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Delete user (cascade will handle related records due to onDelete: Cascade in schema)
    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json(
      { message: "User deleted successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("[ADMIN_USER_DELETE]", error)
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    )
  }
}
