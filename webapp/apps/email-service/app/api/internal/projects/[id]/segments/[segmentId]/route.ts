import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/email-prisma"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; segmentId: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId, segmentId } = await params

  try {
    const existing = await prisma.emailSegment.findUnique({
      where: { id: segmentId, projectId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 })
    }

    await prisma.emailSegment.delete({ where: { id: segmentId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting segment:", error)
    return NextResponse.json({ error: "Failed to delete segment" }, { status: 500 })
  }
}
