import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@droiduse/shared-lib/server"

/**
 * GET /api/settings
 * Fetch all app settings (admin only)
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      )
    }

    const settings = await prisma.appSettings.findMany({
      orderBy: [
        { category: 'asc' },
        { key: 'asc' }
      ]
    })

    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings
 * Create a new setting (admin only)
 */
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { key, value, description, category } = body

    if (!key || !value) {
      return NextResponse.json(
        { error: "Key and value are required" },
        { status: 400 }
      )
    }

    const setting = await prisma.appSettings.create({
      data: {
        key,
        value,
        description,
        category: category || 'other'
      }
    })

    return NextResponse.json({ setting }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating setting:", error)

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: "A setting with this key already exists" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Failed to create setting" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/settings
 * Update an existing setting (admin only)
 */
export async function PATCH(request: Request) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, key, value, description, category } = body

    if (!id) {
      return NextResponse.json(
        { error: "Setting ID is required" },
        { status: 400 }
      )
    }

    const setting = await prisma.appSettings.update({
      where: { id },
      data: {
        ...(key && { key }),
        ...(value !== undefined && { value }),
        ...(description !== undefined && { description }),
        ...(category && { category })
      }
    })

    return NextResponse.json({ setting })
  } catch (error: any) {
    console.error("Error updating setting:", error)

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: "Setting not found" },
        { status: 404 }
      )
    }

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: "A setting with this key already exists" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Failed to update setting" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings
 * Delete a setting (admin only)
 */
export async function DELETE(request: Request) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Setting ID is required" },
        { status: 400 }
      )
    }

    await prisma.appSettings.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting setting:", error)

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: "Setting not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: "Failed to delete setting" },
      { status: 500 }
    )
  }
}
