import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/email-prisma"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listId: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId, listId } = await params

  try {
    const existing = await prisma.contactList.findUnique({
      where: { id: listId, projectId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Contact list not found" }, { status: 404 })
    }

    await prisma.contactList.delete({ where: { id: listId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting contact list:", error)
    return NextResponse.json({ error: "Failed to delete contact list" }, { status: 500 })
  }
}
