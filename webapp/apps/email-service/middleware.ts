import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes - no auth needed
  if (
    pathname.startsWith("/api/mcp") ||
    pathname.startsWith("/api/v1/") ||
    pathname.startsWith("/api/track/") ||
    pathname.startsWith("/api/email/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/process") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/register") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/email/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next()
  }

  // Internal API and dashboard - require session
  const session = await auth()

  if (!session) {
    if (pathname.startsWith("/api/internal/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}

// Use Node.js runtime to support Prisma in middleware
export const runtime = 'nodejs'
