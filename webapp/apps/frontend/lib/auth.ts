import "dotenv/config"
import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import Twitter from "next-auth/providers/twitter"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma, authorizeCredentials, jwtCallback, sessionCallback, getClientGeolocation } from "@droiduse/shared-lib/server"
import { PRICING_TIERS_CLIENT } from "@droiduse/shared-lib"
import { headers } from "next/headers"

// Extend NextAuth types
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string | null
      name: string | null
      image: string | null
      role: string
      product?: string | null
      // Subscription fields
      subscriptionTier?: string | null
      subscriptionStatus?: string | null
      stripeCustomerId?: string | null
    }
  }
}

if (!process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET environment variable is not set. Please add it to your .env file.")
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma as any),
  secret: process.env.AUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Twitter({
      clientId: process.env.AUTH_TWITTER_ID,
      clientSecret: process.env.AUTH_TWITTER_SECRET,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "you@example.com",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      authorize: (credentials) => authorizeCredentials(credentials, { prisma }),
    }),
  ],
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: {
    pkceCodeVerifier: {
      name: "next-auth.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    state: {
      name: "next-auth.state",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    nonce: {
      name: "next-auth.nonce",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async signIn({ user }) {
      // Capture IP geolocation on signin
      if (user?.id) {
        try {
          const headersList = await headers()
          const geolocation = await getClientGeolocation(headersList)

          if (geolocation) {
            // Update user's last login location
            await prisma.user.update({
              where: { id: user.id },
              data: {
                lastLoginIp: geolocation.ip,
                lastLoginCountry: geolocation.country,
                lastLoginCity: geolocation.city,
                lastLoginAt: new Date(),
              },
            }).catch((error) => {
              console.error('[SignIn] Error updating user geolocation:', error)
            })
          }
        } catch (error) {
          console.error('[SignIn] Error capturing geolocation:', error)
          // Don't fail authentication if geolocation fails
        }
      }
      return true
    },
    jwt: jwtCallback,
    session: sessionCallback,
  },
  events: {
    // Initialize free tier credits when a new user signs up via OAuth
    async createUser({ user }) {
      if (user?.id) {
        const freeTierCredits = PRICING_TIERS_CLIENT.free.creditAllowance
        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscriptionTier: 'free',
            creditAllowance: freeTierCredits,
            creditsUsed: 0,
          },
        }).catch((error) => {
          console.error('[CreateUser] Error initializing user credits:', error)
        })
      }
    },
  },
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error",
  },
})
