import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@droiduse/shared-lib/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      ipAddress,
      privateIpAddress,
      port,
      region,
      capacity,
      status,
      description,
      activeConnections,
      version,
      websocketServerRunning
    } = body

    if (!name) {
      return NextResponse.json(
        { error: "Server name is required" },
        { status: 400 }
      )
    }

    // Find server by name
    let server = await prisma.agentServer.findFirst({
      where: { name }
    })

    if (!server) {
      // Auto-register: Create new server
      server = await prisma.agentServer.create({
        data: {
          name,
          ipAddress: ipAddress || "unknown",
          privateIpAddress: privateIpAddress || "unknown",
          port: port || 8000,
          region: region || null,
          capacity: capacity || 10,
          description: description || null,
          status: status || "online",
          activeConnections: activeConnections || 0,
          enabled: true,
          lastPing: new Date(),
        }
      })

      return NextResponse.json({
        success: true,
        message: "Server registered successfully",
        serverId: server.id
      })
    }

    // Update existing server (only if enabled)
    if (!server.enabled) {
      return NextResponse.json(
        { error: "Server is disabled" },
        { status: 403 }
      )
    }

    await prisma.agentServer.update({
      where: { id: server.id },
      data: {
        status: status || "online",
        lastPing: new Date(),
        activeConnections: activeConnections !== undefined ? activeConnections : server.activeConnections,
        // Update fields if provided
        ...(ipAddress && { ipAddress }),
        ...(privateIpAddress && { privateIpAddress }),
        ...(port && { port }),
        ...(region && { region }),
        ...(capacity && { capacity }),
        ...(description && { description }),
      }
    })

    return NextResponse.json({
      success: true,
      message: "Heartbeat received",
      serverId: server.id
    })
  } catch (error: any) {
    console.error("Error processing heartbeat:", error)
    return NextResponse.json(
      { error: error.message || "Failed to process heartbeat" },
      { status: 500 }
    )
  }
}
