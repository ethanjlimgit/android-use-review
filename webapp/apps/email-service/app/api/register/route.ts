import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/email-prisma"
import { registerAdminSchema } from "@/lib/schemas"
import { z } from "zod"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = registerAdminSchema.parse(body)

    const existing = await prisma.adminUser.findUnique({
      where: { email: data.email },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(data.password, 12)

    const user = await prisma.adminUser.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }
    console.error("Error registering admin:", error)
    return NextResponse.json({ error: "Failed to register" }, { status: 500 })
  }
}
