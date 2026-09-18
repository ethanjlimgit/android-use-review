import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/email-prisma"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 })
    }

    const contact = await prisma.contact.findUnique({
      where: { unsubscribeToken: token },
    })

    if (!contact) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 })
    }

    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        emailUnsubscribed: false,
        emailUnsubscribedAt: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error processing resubscribe:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
