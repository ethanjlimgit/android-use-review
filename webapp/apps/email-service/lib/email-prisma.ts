import { PrismaClient } from "@/generated/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const adapter = new PrismaPg(pool)

const globalForPrisma = globalThis as unknown as {
  emailPrisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.emailPrisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.emailPrisma = prisma
}
