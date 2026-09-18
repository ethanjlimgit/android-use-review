import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@droiduse/shared-lib/server"
import { PRICING_TIERS_CLIENT } from "@droiduse/shared-lib"

/**
 * POST /api/admin/migrate-credits
 * Migrates existing users with 0 credit allowance to free tier credits.
 */
export async function POST() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  if (session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden - admin access required" },
      { status: 403 }
    )
  }

  try {
    const freeTierCredits = PRICING_TIERS_CLIENT.free.creditAllowance

    const result = await prisma.user.updateMany({
      where: {
        creditAllowance: 0,
      },
      data: {
        creditAllowance: freeTierCredits,
        subscriptionTier: 'free',
      },
    })

    return NextResponse.json({
      success: true,
      message: `Updated ${result.count} users with free tier credits (${freeTierCredits})`,
      updatedCount: result.count,
    })
  } catch (error) {
    console.error("Error migrating user credits:", error)
    return NextResponse.json(
      { error: "Failed to migrate user credits" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/migrate-credits
 * Get stats about users who need credit migration.
 */
export async function GET() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  if (session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden - admin access required" },
      { status: 403 }
    )
  }

  try {
    const usersWithZeroCredits = await prisma.user.count({
      where: { creditAllowance: 0 },
    })

    const totalUsers = await prisma.user.count()

    const creditStats = await prisma.user.aggregate({
      _sum: { creditsUsed: true },
      _avg: { creditsUsed: true },
    })

    return NextResponse.json({
      usersWithZeroCredits,
      totalUsers,
      totalCreditsUsed: creditStats._sum.creditsUsed || 0,
      avgCreditsUsed: Math.round(creditStats._avg.creditsUsed || 0),
    })
  } catch (error) {
    console.error("Error fetching credit stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch credit stats" },
      { status: 500 }
    )
  }
}
