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
    const enabled = searchParams.get("enabled")
    const status = searchParams.get("status")
    const region = searchParams.get("region")

    const where: any = {}

    if (enabled !== null && enabled !== undefined) {
      where.enabled = enabled === "true"
    }

    if (status) {
      where.status = status
    }

    if (region) {
      where.region = region
    }

    const servers = await prisma.agentServer.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ servers })
  } catch (error) {
    console.error("Error fetching agent servers:", error)
    return NextResponse.json(
      { error: "Failed to fetch agent servers" },
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
    const { name, ipAddress, privateIpAddress, port, description, region, capacity, enabled } = body

    if (!name || !ipAddress || !privateIpAddress) {
      return NextResponse.json(
        { error: "Name, public IP address, and private IP address are required" },
        { status: 400 }
      )
    }

    const server = await prisma.agentServer.create({
      data: {
        name,
        ipAddress,
        privateIpAddress,
        port: port || 8000,
        description: description || null,
        region: region || null,
        capacity: capacity || 10,
        enabled: enabled !== undefined ? enabled : true,
      },
    })

    return NextResponse.json({ server }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating agent server:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create agent server" },
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
    const { id, name, ipAddress, privateIpAddress, port, description, region, capacity, enabled, status, lastPing } = body

    if (!id) {
      return NextResponse.json(
        { error: "Server ID is required" },
        { status: 400 }
      )
    }

    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    if (ipAddress !== undefined) updateData.ipAddress = ipAddress
    if (privateIpAddress !== undefined) updateData.privateIpAddress = privateIpAddress
    if (port !== undefined) updateData.port = port
    if (description !== undefined) updateData.description = description
    if (region !== undefined) updateData.region = region
    if (capacity !== undefined) updateData.capacity = capacity
    if (enabled !== undefined) updateData.enabled = enabled
    if (status !== undefined) updateData.status = status
    if (lastPing !== undefined) updateData.lastPing = lastPing ? new Date(lastPing) : null

    const server = await prisma.agentServer.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ server })
  } catch (error: any) {
    console.error("Error updating agent server:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update agent server" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth()

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Server ID is required" },
        { status: 400 }
      )
    }

    await prisma.agentServer.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting agent server:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete agent server" },
      { status: 500 }
    )
  }
}
