import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { storage, verifyMobileToken, extractBearerToken } from "@droiduse/shared-lib/server"
import type { Skill } from "@droiduse/shared-lib"
import { z } from "zod"

/**
 * Custom API Error class for consistent error handling
 */
export class ApiError extends Error {
  constructor(public message: string, public status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Session type returned by auth helpers
 */
export type AuthSession = {
  user: {
    id: string
    email: string | null
    name: string | null
    role?: string
  }
}

/**
 * Requires authentication and returns the session
 * Supports both NextAuth sessions (web) and JWT tokens (mobile)
 *
 * @param request - Optional NextRequest to check for Authorization header
 * @throws ApiError(401) if not authenticated
 */
export async function requireAuth(request?: NextRequest): Promise<AuthSession> {
  // First, try to authenticate via Authorization header (mobile JWT)
  if (request) {
    const authHeader = request.headers.get("Authorization")
    const token = extractBearerToken(authHeader)

    if (token) {
      const user = verifyMobileToken(token)

      if (user) {
        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          }
        }
      }
      // If token exists but is invalid/expired, throw error
      console.error("[requireAuth] Mobile token verification failed")
      throw new ApiError("Invalid or expired token", 401)
    }
  }

  // Fall back to NextAuth session (web)
  try {
    const session = await auth()

    if (!session?.user?.id) {
      console.error("[requireAuth] No valid session found")
      throw new ApiError("Unauthorized", 401)
    }

    return session as AuthSession
  } catch (error) {
    // Handle NextAuth JWT errors (e.g., mismatched AUTH_SECRET)
    if (error instanceof Error && error.message.includes("no matching decryption secret")) {
      console.error("[requireAuth] JWT decryption failed - possible AUTH_SECRET mismatch. User needs to clear cookies and re-login.")
      throw new ApiError("Session invalid - please clear cookies and sign in again", 401)
    }

    // Re-throw ApiError instances
    if (error instanceof ApiError) {
      throw error
    }

    // Log and handle unexpected errors
    console.error("[requireAuth] Unexpected authentication error:", error)
    throw new ApiError("Authentication failed", 401)
  }
}

/**
 * Validates request body against a Zod schema
 * @throws ApiError(400) with validation details if invalid
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json()
    return schema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(
        JSON.stringify({ error: "Invalid data", details: error.issues }),
        400
      )
    }
    throw error
  }
}

/**
 * Wraps an API handler with automatic error handling
 * Use this to eliminate try/catch boilerplate
 */
export function apiHandler<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleApiError(error)
    }
  }
}

/**
 * Verifies user authentication and ownership of a knowledge entry
 * @throws ApiError if unauthorized or forbidden
 */
export async function verifySkillOwnership(
  skillId: string
): Promise<{ session: AuthSession; skill: Skill }> {
  const session = await requireAuth()

  const skill = await storage.getSkillById(skillId)

  if (!skill) {
    throw new ApiError("Skill not found", 404)
  }

  if (skill.authorId !== session.user.id && session.user.role !== 'admin') {
    throw new ApiError("Forbidden - you don't own this skill", 403)
  }

  return { session, skill }
}

/**
 * Handles API errors and returns appropriate NextResponse
 * Supports ApiError, ZodError, and generic errors
 */
export function handleApiError(error: unknown): NextResponse {
  // Handle custom ApiError
  if (error instanceof ApiError) {
    // Check if message is JSON (from validateBody)
    try {
      const parsed = JSON.parse(error.message)
      // Log validation errors with formatted details
      console.error(`[api] ApiError ${error.status}:`, JSON.stringify(parsed, null, 2))
      return NextResponse.json(parsed, { status: error.status })
    } catch {
      // Log regular ApiErrors
      console.error(`[api] ApiError ${error.status}:`, error.message)
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
  }

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Invalid data", details: error.issues },
      { status: 400 }
    )
  }

  // Handle generic errors
  console.error("[api] Unexpected error:", error)
  return NextResponse.json(
    {
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    },
    { status: 500 }
  )
}
