import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { auth } from "@/lib/auth"
import { prisma } from "@droiduse/shared-lib/server"
import { FileText, Users, AppWindow, BookOpen, Smartphone, ListTodo, Coins, ArrowRight } from "lucide-react"

async function getDashboardStats() {
  const [
    blogPostCount,
    userCount,
    appCount,
    skillCount,
    deviceCount,
    taskCount,
    creditStats,
    usersWithZeroCredits,
  ] = await Promise.all([
    prisma.blogPost.count(),
    prisma.user.count(),
    prisma.app.count(),
    prisma.skill.count(),
    prisma.device.count(),
    prisma.task.count(),
    prisma.user.aggregate({
      _sum: { creditsUsed: true, creditAllowance: true },
    }),
    prisma.user.count({ where: { creditAllowance: 0 } }),
  ])

  return {
    blogPostCount,
    userCount,
    appCount,
    skillCount,
    deviceCount,
    taskCount,
    totalCreditsUsed: creditStats._sum.creditsUsed || 0,
    totalCreditAllowance: creditStats._sum.creditAllowance || 0,
    usersWithZeroCredits,
  }
}

export default async function AdminDashboard() {
  const session = await auth()
  const stats = await getDashboardStats()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session?.user?.name || session?.user?.email}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/users/stats">
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.userCount}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                View detailed stats
                <ArrowRight className="h-3 w-3" />
              </p>
            </CardContent>
          </Card>
        </Link>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Devices</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deviceCount}</div>
            <p className="text-xs text-muted-foreground">Registered devices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.taskCount}</div>
            <p className="text-xs text-muted-foreground">Total tasks executed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Used</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCreditsUsed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              of {stats.totalCreditAllowance.toLocaleString()} total allowance
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blog Posts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.blogPostCount}</div>
            <p className="text-xs text-muted-foreground">Published articles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Apps</CardTitle>
            <AppWindow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.appCount}</div>
            <p className="text-xs text-muted-foreground">Registered applications</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Skills</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.skillCount}</div>
            <p className="text-xs text-muted-foreground">Skill entries</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
