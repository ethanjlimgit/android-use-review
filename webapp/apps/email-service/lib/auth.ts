import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./email-prisma"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string | null
      name: string | null
      role: string
    }
  }
}

if (!process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET environment variable is not set")
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined

        if (!email || !password) return null

        const user = await prisma.adminUser.findUnique({
          where: { email },
        })

        if (!user) return null

        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = (token.role as string) || "admin"
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
})
