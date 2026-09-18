import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@droiduse/shared-lib/server"

export async function GET() {
  try {
    const session = await auth()
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get total users and basic stats
    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      verifiedUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { banned: false } }),
      prisma.user.count({ where: { banned: true } }),
      prisma.user.count({ where: { emailVerified: { not: null } } }),
    ])

    // Get geo distribution (by country)
    const geoGroups = await prisma.user.groupBy({
      by: ["lastLoginCountry"],
      where: {
        lastLoginCountry: { not: null },
      },
      _count: { _all: true },
    })

    const geoDistribution = geoGroups
      .filter((g) => g.lastLoginCountry)
      .map((g) => ({
        country: g.lastLoginCountry!,
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count)

    // Get user acquisition over time (last 90 days, grouped by day)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const usersOverTime = await prisma.user.findMany({
      where: {
        createdAt: { gte: ninetyDaysAgo },
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    })

    // Group by date
    const acquisitionByDate: Record<string, number> = {}
    usersOverTime.forEach((user) => {
      const dateKey = user.createdAt.toISOString().split("T")[0]
      acquisitionByDate[dateKey] = (acquisitionByDate[dateKey] || 0) + 1
    })

    // Fill in missing dates and calculate cumulative
    const userAcquisition: { date: string; newUsers: number; cumulative: number }[] = []
    let cumulative = await prisma.user.count({
      where: { createdAt: { lt: ninetyDaysAgo } },
    })

    for (let i = 89; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split("T")[0]
      const newUsers = acquisitionByDate[dateKey] || 0
      cumulative += newUsers
      userAcquisition.push({
        date: dateKey,
        newUsers,
        cumulative,
      })
    }

    // Get credit usage distribution
    const creditStats = await prisma.user.aggregate({
      _sum: { creditsUsed: true, creditAllowance: true, freeBonusCredits: true },
      _avg: { creditsUsed: true, creditAllowance: true },
      _max: { creditsUsed: true },
    })

    // Credit usage buckets
    const creditBuckets = await Promise.all([
      prisma.user.count({ where: { creditsUsed: 0 } }),
      prisma.user.count({ where: { creditsUsed: { gt: 0, lte: 100 } } }),
      prisma.user.count({ where: { creditsUsed: { gt: 100, lte: 500 } } }),
      prisma.user.count({ where: { creditsUsed: { gt: 500, lte: 1000 } } }),
      prisma.user.count({ where: { creditsUsed: { gt: 1000, lte: 5000 } } }),
      prisma.user.count({ where: { creditsUsed: { gt: 5000 } } }),
    ])

    const creditDistribution = [
      { range: "0", count: creditBuckets[0] },
      { range: "1-100", count: creditBuckets[1] },
      { range: "101-500", count: creditBuckets[2] },
      { range: "501-1000", count: creditBuckets[3] },
      { range: "1001-5000", count: creditBuckets[4] },
      { range: "5000+", count: creditBuckets[5] },
    ]

    // Subscription tier distribution
    const subscriptionGroups = await prisma.user.groupBy({
      by: ["subscriptionTier"],
      _count: { _all: true },
    })

    const subscriptionDistribution = subscriptionGroups.map((g) => ({
      tier: g.subscriptionTier || "free",
      count: g._count._all,
    }))

    // Auth provider distribution (from accounts)
    const providerGroups = await prisma.account.groupBy({
      by: ["provider"],
      _count: { _all: true },
    })

    const authProviderDistribution = providerGroups.map((g) => ({
      provider: g.provider,
      count: g._count._all,
    }))

    // Add credentials count (users with password but no OAuth)
    const credentialsCount = await prisma.user.count({
      where: {
        password: { not: null },
        accounts: { none: {} },
      },
    })

    if (credentialsCount > 0) {
      authProviderDistribution.push({
        provider: "credentials",
        count: credentialsCount,
      })
    }

    // Weekly active users (logged in within last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const weeklyActiveUsers = await prisma.user.count({
      where: { lastLoginAt: { gte: sevenDaysAgo } },
    })

    // Monthly active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const monthlyActiveUsers = await prisma.user.count({
      where: { lastLoginAt: { gte: thirtyDaysAgo } },
    })

    // Referral stats
    const referralStats = await prisma.user.aggregate({
      _sum: { referralCount: true },
      _count: { referralCode: true },
    })

    const usersWithReferrals = await prisma.user.count({
      where: { referralCount: { gt: 0 } },
    })

    return NextResponse.json({
      overview: {
        totalUsers,
        activeUsers,
        bannedUsers,
        verifiedUsers,
        weeklyActiveUsers,
        monthlyActiveUsers,
      },
      geoDistribution,
      userAcquisition,
      creditStats: {
        totalUsed: creditStats._sum.creditsUsed || 0,
        totalAllowance: creditStats._sum.creditAllowance || 0,
        totalBonusCredits: creditStats._sum.freeBonusCredits || 0,
        avgUsed: Math.round(creditStats._avg.creditsUsed || 0),
        avgAllowance: Math.round(creditStats._avg.creditAllowance || 0),
        maxUsed: creditStats._max.creditsUsed || 0,
      },
      creditDistribution,
      subscriptionDistribution,
      authProviderDistribution,
      referralStats: {
        totalReferrals: referralStats._sum.referralCount || 0,
        usersWithReferralCode: referralStats._count.referralCode || 0,
        usersWithReferrals,
      },
    })
  } catch (error) {
    console.error("Error fetching user stats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
