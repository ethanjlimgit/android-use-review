import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/email-prisma"

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
)

export async function GET(request: NextRequest) {
  const recipientId = request.nextUrl.searchParams.get("rid")

  // Always return the tracking pixel, even on error
  const response = new NextResponse(TRANSPARENT_GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      Expires: "0",
    },
  })

  if (!recipientId || recipientId === "test-preview") {
    return response
  }

  try {
    await prisma.emailEvent.create({
      data: {
        recipientId,
        eventType: "OPENED",
        userAgent: request.headers.get("user-agent") || null,
        ip:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        timestamp: new Date(),
      },
    })
  } catch (error) {
    // Silently fail - don't let tracking errors affect the response
    console.error("[track/open] Failed to record event:", error)
  }

  return response
}
