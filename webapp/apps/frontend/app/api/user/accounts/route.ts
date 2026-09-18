import { NextRequest, NextResponse } from "next/server"
import { apiHandler, requireAuth } from "@/lib/api-helpers"
import { prisma } from "@droiduse/shared-lib/server"

/**
 * GET /api/user/accounts
 * Get all linked OAuth accounts for the authenticated user
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request)

  const accounts = await prisma.account.findMany({
    where: {
      userId: session.user.id,
    },
    select: {
      provider: true,
      providerAccountId: true,
    },
  })

  return NextResponse.json({
    accounts,
  })
})

