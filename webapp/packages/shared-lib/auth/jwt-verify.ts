import jwt from "jsonwebtoken"
import type { AuthUser } from "./types"

/**
 * JWT payload structure for mobile tokens
 */
export interface MobileJwtPayload {
  userId: string
  email: string
  role: string
  iat?: number
  exp?: number
}

/**
 * Verifies a JWT token and returns the decoded user data
 *
 * @param token - The JWT token to verify
 * @param secret - The secret key used to sign the token (defaults to AUTH_SECRET)
 * @returns Decoded user data or null if verification fails
 */
export function verifyMobileToken(
  token: string,
  secret?: string
): AuthUser | null {
  const authSecret = secret || process.env.AUTH_SECRET

  if (!authSecret) {
    console.error("[jwt-verify] AUTH_SECRET is not configured")
    return null
  }

  try {
    const decoded = jwt.verify(token, authSecret) as MobileJwtPayload

    // Validate required fields
    if (!decoded.userId || !decoded.email) {
      console.error("[jwt-verify] Invalid token payload: missing required fields")
      return null
    }

    return {
      id: decoded.userId,
      email: decoded.email,
      name: null, // Name not included in mobile token
      image: null, // Image not included in mobile token
      role: decoded.role || "user",
    }
  } catch (error: unknown) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error("[jwt-verify] Token expired")
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.error("[jwt-verify] Invalid token:", error.message)
    } else {
      console.error("[jwt-verify] Token verification failed:", error)
    }
    return null
  }
}

/**
 * Extracts Bearer token from Authorization header
 *
 * @param authHeader - The Authorization header value
 * @returns The token string or null if not found or invalid format
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null
  }

  const parts = authHeader.split(" ")
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null
  }

  return parts[1]
}
