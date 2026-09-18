import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/email-prisma"

// GET: Validate unsubscribe token and return contact email
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 })
  }

  try {
    const contact = await prisma.contact.findUnique({
      where: { unsubscribeToken: token },
      select: { email: true, emailUnsubscribed: true },
    })

    if (!contact) {
      return NextResponse.json(
        { error: "Invalid unsubscribe link" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      email: contact.email,
      alreadyUnsubscribed: contact.emailUnsubscribed,
    })
  } catch (error) {
    console.error("Error validating unsubscribe token:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// POST: Execute unsubscribe
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
      return NextResponse.json(
        { error: "Invalid unsubscribe link" },
        { status: 404 }
      )
    }

    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        emailUnsubscribed: true,
        emailUnsubscribedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error processing unsubscribe:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
