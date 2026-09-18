import { z } from "zod"
import bcrypt from "bcryptjs"
import type { AuthUser, UserWithRole } from "./types"

/**
 * Credentials validation schema
 */
export const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export type Credentials = z.infer<typeof credentialsSchema>

/**
 * Options for credentials authorization
 */
export interface AuthorizeOptions {
  /**
   * Prisma client instance
   */
  prisma: any

  /**
   * Whether to require admin role
   */
  requireAdmin?: boolean

  /**
   * Custom role validator function
   */
  roleValidator?: (user: UserWithRole) => boolean
}

/**
 * Shared credentials authorization logic
 *
 * @param credentials - User credentials (email, password)
 * @param options - Authorization options
 * @returns Authorized user object or null if authentication fails
 */
export async function authorizeCredentials(
  credentials: Record<string, unknown> | undefined,
  options: AuthorizeOptions
): Promise<AuthUser | null> {
  const { prisma, requireAdmin = false, roleValidator } = options

  // Validate credentials format
  const parsedCredentials = credentialsSchema.safeParse(credentials)

  if (!parsedCredentials.success) {
    if (process.env.NODE_ENV === "development") {
      console.error("[auth][error] Invalid credentials format:", parsedCredentials.error.format())
    }
    return null
  }

  const { email, password } = parsedCredentials.data

  try {
    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Return null if user doesn't exist or has no password
    if (!user) {
      if (process.env.NODE_ENV === "development") {
        console.error("[auth][error] User not found:", email)
      }
      return null
    }

    if (!user.password) {
      if (process.env.NODE_ENV === "development") {
        console.error("[auth][error] User has no password set:", email)
      }
      return null
    }

    // Type cast to include role and banned fields
    const userWithRole = user as UserWithRole

    // Check if user is banned
    if (userWithRole.banned) {
      if (process.env.NODE_ENV === "development") {
        console.error("[auth][error] User is banned:", email)
      }
      return null
    }

    // Check if email is verified (only for users with password-based auth)
    if (!user.emailVerified) {
      if (process.env.NODE_ENV === "development") {
        console.error("[auth][error] Email not verified:", email)
      }
      return null
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password)

    if (!isValid) {
      if (process.env.NODE_ENV === "development") {
        console.error("[auth][error] Invalid password for user:", email)
      }
      return null
    }

    // Check admin requirement
    if (requireAdmin && userWithRole.role !== "admin") {
      if (process.env.NODE_ENV === "development") {
        console.error("[auth][error] User is not an admin:", email)
      }
      return null
    }

    // Custom role validation
    if (roleValidator && !roleValidator(userWithRole)) {
      if (process.env.NODE_ENV === "development") {
        console.error("[auth][error] Custom role validation failed:", email)
      }
      return null
    }

    // Return user object on successful authentication
    if (process.env.NODE_ENV === "development") {
      console.log("[auth][success] User authenticated:", email)
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: userWithRole.role || "user",
    }
  } catch (error) {
    // Log error for debugging but don't expose details to client
    console.error("[auth][error] Authentication error:", error)
    if (error instanceof Error) {
      console.error("[auth][error] Error message:", error.message)
      console.error("[auth][error] Error stack:", error.stack)
    }
    return null
  }
}
