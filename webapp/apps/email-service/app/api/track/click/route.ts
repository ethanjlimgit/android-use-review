import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/email-prisma"

export async function GET(request: NextRequest) {
  const recipientId = request.nextUrl.searchParams.get("rid")
  const url = request.nextUrl.searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
  }

  // Validate URL to prevent open redirect
  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }

  if (recipientId && recipientId !== "test-preview") {
    try {
      await prisma.emailEvent.create({
        data: {
          recipientId,
          eventType: "CLICKED",
          url,
          userAgent: request.headers.get("user-agent") || null,
          ip:
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            null,
          timestamp: new Date(),
        },
      })
    } catch (error) {
      console.error("[track/click] Failed to record event:", error)
    }
  }

  return NextResponse.redirect(url)
}
