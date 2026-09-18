import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/email-prisma"
import { createApiKeySchema } from "@/lib/schemas"
import { z } from "zod"
import crypto from "crypto"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params

    const project = await prisma.project.findUnique({
      where: { id },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: { projectId: id },
      select: {
        id: true,
        projectId: true,
        keyPrefix: true,
        name: true,
        scopes: true,
        enabled: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(apiKeys)
  } catch (error) {
    console.error("Error fetching API keys:", error)
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const data = createApiKeySchema.parse(body)

    const project = await prisma.project.findUnique({
      where: { id },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Generate the API key
    const rawKey = `em_${crypto.randomUUID().replace(/-/g, "")}`
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex")
    const keyPrefix = rawKey.substring(3, 11) // First 8 chars after "em_"

    const apiKey = await prisma.apiKey.create({
      data: {
        projectId: id,
        keyHash,
        keyPrefix,
        name: data.name,
        scopes: data.scopes,
        expiresAt: data.expiresAt,
      },
      select: {
        id: true,
        projectId: true,
        keyPrefix: true,
        name: true,
        scopes: true,
        enabled: true,
        expiresAt: true,
        createdAt: true,
      },
    })

    // Return the full key ONLY on creation
    return NextResponse.json({ ...apiKey, key: rawKey }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }
    console.error("Error creating API key:", error)
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get("keyId")

    if (!keyId) {
      return NextResponse.json({ error: "keyId query parameter is required" }, { status: 400 })
    }

    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, projectId: id },
    })

    if (!apiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 })
    }

    await prisma.apiKey.delete({
      where: { id: keyId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting API key:", error)
    return NextResponse.json({ error: "Failed to delete API key" }, { status: 500 })
  }
}
