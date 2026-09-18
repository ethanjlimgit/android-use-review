// Use any types to avoid direct next-auth dependency
// These are satisfied by the peerDependency in consuming apps
type JWT = any
type Session = any
type User = any

/**
 * Shared JWT callback
 * Adds user id, role, and subscription data to the token
 */
export async function jwtCallback({ token, user }: { token: JWT; user?: User }) {
  if (user) {
    token.id = user.id
    token.role = (user as any).role || "user"
    token.product = (user as any).product
    token.subscriptionTier = (user as any).subscriptionTier
    token.subscriptionStatus = (user as any).subscriptionStatus
    token.stripeCustomerId = (user as any).stripeCustomerId
  }
  return token
}

/**
 * Shared session callback
 * Adds user id, role, and subscription data to the session from the token
 */
export async function sessionCallback({ session, token }: { session: Session; token: JWT }) {
  if (session.user) {
    session.user.id = token.id as string
    session.user.role = (token.role as string) || "user"
    session.user.product = token.product as string | null
    session.user.subscriptionTier = token.subscriptionTier as string | null
    session.user.subscriptionStatus = token.subscriptionStatus as string | null
    session.user.stripeCustomerId = token.stripeCustomerId as string | null
  }
  return session
}
