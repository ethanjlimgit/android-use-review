import "dotenv/config"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma, authorizeCredentials, jwtCallback, sessionCallback, getClientGeolocation } from "@droiduse/shared-lib/server"
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
    }
  }
}

if (!process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET environment variable is not set")
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma as any),
  secret: process.env.AUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "admin@example.com",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      authorize: (credentials) => authorizeCredentials(credentials, {
        prisma,
        requireAdmin: true
      }),
    }),
  ],
  session: {
    strategy: "jwt",
  },
  trustHost: true,
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
              console.error('[Admin SignIn] Error updating user geolocation:', error)
            })
          }
        } catch (error) {
          console.error('[Admin SignIn] Error capturing geolocation:', error)
          // Don't fail authentication if geolocation fails
        }
      }
      return true
    },
    jwt: jwtCallback,
    session: sessionCallback,
  },
  pages: {
    signIn: "/login",
  },
})
