import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

const POSTHOG_DISTINCT_ID_COOKIE = "ph_distinct_id"

export async function middleware(request: NextRequest) {
  const session = await auth()
  let response: NextResponse

  // Define public paths that don't require authentication
  const publicPaths = ['/auth', '/onboarding', '/api', '/_next', '/favicon.ico', '/marketplace', '/blog', '/legal', '/products', '/pricing']
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path)) || request.nextUrl.pathname === '/'

  // Check if request is for a static file (images, fonts, etc.)
  const staticFileExtensions = /\.(png|mp4|mp3|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot|pdf|txt|xml|webmanifest)$/i
  const isStaticFile = staticFileExtensions.test(request.nextUrl.pathname)

  // Allow public paths and static files
  if (isPublicPath || isStaticFile) {
    response = NextResponse.next()
    return setDistinctIdCookie(request, response)
  }

  // Redirect to sign-in if not authenticated
  if (!session?.user) {
    const signInUrl = new URL('/auth/signin', request.url)
    signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)
    response = NextResponse.redirect(signInUrl)
    return setDistinctIdCookie(request, response)
  }

  response = NextResponse.next()
  return setDistinctIdCookie(request, response)
}

/**
 * Set PostHog distinct ID cookie if it doesn't exist
 * Used for server-side A/B testing
 */
function setDistinctIdCookie(request: NextRequest, response: NextResponse): NextResponse {
  if (!request.cookies.get(POSTHOG_DISTINCT_ID_COOKIE)) {
    response.cookies.set(POSTHOG_DISTINCT_ID_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })
  }
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon, robots, sitemap, manifest (metadata files)
     * - Files with common static extensions
     */
    '/:path*',
  ],
}

// Use Node.js runtime to support Prisma in middleware
export const runtime = 'nodejs'
