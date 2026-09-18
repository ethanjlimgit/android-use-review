import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Allow login page, API routes, and static assets
  if (pathname === "/login" || pathname.startsWith("/api") || pathname.startsWith("/_next")) {
    return NextResponse.next()
  }

  // Get session
  const session = await auth()

  // Check if session exists and user has admin role
  if (!session?.user || session.user.role !== "admin") {
    // Only redirect if not already on login page
    if (pathname !== "/login") {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
