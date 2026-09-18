import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { storage, insertAppSchema } from "@droiduse/shared-lib/server"
import { prisma } from "@droiduse/shared-lib/server"
import { z } from "zod"

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search")
    const limit = searchParams.get("limit")
    const offset = searchParams.get("offset")

    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { packagePath: { contains: search, mode: "insensitive" } },
      ]
    }

    const [apps, total] = await Promise.all([
      prisma.app.findMany({
        where,
        take: limit ? parseInt(limit) : undefined,
        skip: offset ? parseInt(offset) : undefined,
        orderBy: { name: "asc" },
      }),
      prisma.app.count({ where }),
    ])

    return NextResponse.json({ apps, total })
  } catch (error) {
    console.error("Error fetching apps:", error)
    return NextResponse.json(
      { error: "Failed to fetch apps" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validatedData = insertAppSchema.parse(body)
    
    const app = await storage.createApp(validatedData)
    return NextResponse.json(app, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error creating app:", error)
    return NextResponse.json(
      { error: "Failed to create app" },
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
    const { appId, settings, enabled } = body

    const updateData: any = {}
    if (settings !== undefined) {
      updateData.settings = typeof settings === "string" ? settings : JSON.stringify(settings)
    }
    if (enabled !== undefined) {
      updateData.enabled = enabled
    }

    const app = await storage.updateApp(appId, updateData)
    
    if (!app) {
      return NextResponse.json(
        { error: "App not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(app)
  } catch (error) {
    console.error("Error updating app:", error)
    return NextResponse.json(
      { error: "Failed to update app" },
      { status: 500 }
    )
  }
}

