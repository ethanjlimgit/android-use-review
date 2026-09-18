/**
 * Shared authentication types
 */

export interface AuthUser {
  id: string
  email: string
  name: string | null
  image: string | null
  role: string
}

export interface UserWithRole {
  id: string
  email: string
  name: string | null
  image: string | null
  password: string | null
  role?: string
  banned?: boolean
}

/**
 * Note: NextAuth module augmentation should be done in the consuming app's auth file,
 * not in shared-lib, since next-auth is a peerDependency
 */
