import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@droiduse/shared-lib/server"

export async function GET() {
  try {
    const session = await auth()
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get total users and survey completion stats
    const [totalUsers, surveyCompletedCount] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { surveyCompleted: true } }),
    ])

    // Get user type distribution
    const userTypeGroups = await prisma.user.groupBy({
      by: ["userType"],
      where: { surveyCompleted: true },
      _count: { _all: true },
    })

    const userTypeDistribution = [
      {
        name: "Individual",
        value: userTypeGroups.find((g) => g.userType === "individual")?._count._all || 0,
        fill: "#6366f1",
      },
      {
        name: "Company",
        value: userTypeGroups.find((g) => g.userType === "company")?._count._all || 0,
        fill: "#22c55e",
      },
    ]

    // Get company size distribution
    const companySizeGroups = await prisma.user.groupBy({
      by: ["companySize"],
      where: {
        surveyCompleted: true,
        companySize: { not: null },
      },
      _count: { _all: true },
    })

    const companySizeOrder = ["just_me", "2-10", "11-50", "51-200", "201-1000", "1000+"]
    const companySizeLabels: Record<string, string> = {
      just_me: "Just me",
      "2-10": "2-10",
      "11-50": "11-50",
      "51-200": "51-200",
      "201-1000": "201-1000",
      "1000+": "1000+",
    }

    const companySizeDistribution = companySizeOrder.map((size) => ({
      name: companySizeLabels[size] || size,
      value: companySizeGroups.find((g) => g.companySize === size)?._count._all || 0,
    }))

    // Get industry distribution (top categories)
    const industryGroups = await prisma.user.groupBy({
      by: ["industry"],
      where: {
        surveyCompleted: true,
        industry: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { industry: "desc" } },
      take: 15,
    })

    const industryDistribution = industryGroups
      .filter((g) => g.industry)
      .map((g) => ({
        name: g.industry || "Unknown",
        value: g._count._all,
      }))
      .sort((a, b) => b.value - a.value)

    // Get occupation distribution
    const occupationGroups = await prisma.user.groupBy({
      by: ["occupation"],
      where: {
        surveyCompleted: true,
        occupation: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { occupation: "desc" } },
      take: 10,
    })

    const occupationDistribution = occupationGroups
      .filter((g) => g.occupation)
      .map((g, index) => ({
        name: g.occupation || "Unknown",
        value: g._count._all,
        fill: ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"][index % 6],
      }))

    // Get survey completion over time (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const completionsOverTime = await prisma.user.findMany({
      where: {
        surveyCompleted: true,
        surveyCompletedAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        surveyCompletedAt: true,
      },
      orderBy: {
        surveyCompletedAt: "asc",
      },
    })

    // Group by date
    const completionsByDate: Record<string, number> = {}
    completionsOverTime.forEach((user) => {
      if (user.surveyCompletedAt) {
        const dateKey = user.surveyCompletedAt.toISOString().split("T")[0]
        completionsByDate[dateKey] = (completionsByDate[dateKey] || 0) + 1
      }
    })

    // Fill in missing dates
    const completionOverTime: { date: string; count: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split("T")[0]
      completionOverTime.push({
        date: dateKey,
        count: completionsByDate[dateKey] || 0,
      })
    }

    const completionRate = totalUsers > 0 ? (surveyCompletedCount / totalUsers) * 100 : 0

    return NextResponse.json({
      totalUsers,
      surveyCompleted: surveyCompletedCount,
      completionRate,
      userTypeDistribution,
      companySizeDistribution,
      industryDistribution,
      occupationDistribution,
      completionOverTime,
    })
  } catch (error) {
    console.error("Error fetching survey stats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
