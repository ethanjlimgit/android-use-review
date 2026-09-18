import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@droiduse/shared-lib/server"

export async function GET() {
  try {
    const session = await auth()
    const userCount = await prisma.user.count()
    const sampleUsers = await prisma.user.findMany({
      take: 3,
      select: { id: true, email: true, role: true },
    })

    return NextResponse.json({
      session: session ? { id: session.user.id, role: session.user.role } : null,
      userCount,
      sampleUsers,
    })
  } catch (error) {
    return NextResponse.json({
      error: String(error),
    }, { status: 500 })
  }
}
