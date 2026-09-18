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
    const role = searchParams.get("role")
    const banned = searchParams.get("banned")
    const limit = searchParams.get("limit")
    const offset = searchParams.get("offset")

    const where: any = {}

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
      ]
    }

    if (role) {
      where.role = role
    }

    // Only filter by banned if explicitly provided as "true" or "false"
    if (banned === "true" || banned === "false") {
      where.banned = banned === "true"
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        take: limit ? parseInt(limit) : undefined,
        skip: offset ? parseInt(offset) : undefined,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          role: true,
          banned: true,
          bannedAt: true,
          bannedReason: true,
          createdAt: true,
          lastLoginIp: true,
          lastLoginCountry: true,
          lastLoginCity: true,
          lastLoginAt: true,
          _count: {
            select: {
              tasks: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({ users, total })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth()

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { userId, banned, bannedReason, role } = body

    // Prevent admin from changing their own role
    if (role !== undefined && userId === session.user.id) {
      return NextResponse.json(
        { error: "You cannot change your own role" },
        { status: 400 }
      )
    }

    // Validate role if provided
    if (role !== undefined && !["user", "admin"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'user' or 'admin'" },
        { status: 400 }
      )
    }

    // Build update data object
    const updateData: any = {}

    // Handle ban status update
    if (banned !== undefined) {
      updateData.banned = banned
      updateData.bannedAt = banned ? new Date() : null
      updateData.bannedReason = banned ? bannedReason || null : null
    }

    // Handle role update
    if (role !== undefined) {
      updateData.role = role
    }

    // At least one field must be provided
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No update fields provided" },
        { status: 400 }
      )
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    )
  }
}

