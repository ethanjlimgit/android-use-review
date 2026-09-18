"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@droiduse/shared-ui/card"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts"
import { ClipboardList, Users, Building2, TrendingUp } from "lucide-react"

interface SurveyStats {
  totalUsers: number
  surveyCompleted: number
  completionRate: number
  userTypeDistribution: { name: string; value: number; fill: string }[]
  companySizeDistribution: { name: string; value: number }[]
  industryDistribution: { name: string; value: number }[]
  occupationDistribution: { name: string; value: number; fill: string }[]
  completionOverTime: { date: string; count: number }[]
}

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]

async function fetchSurveyStats(): Promise<SurveyStats> {
  const response = await fetch("/api/admin/survey-stats")
  if (!response.ok) {
    throw new Error("Failed to fetch survey stats")
  }
  return response.json()
}

// Custom tooltip component
function CustomTooltip({
  active,
  payload,
  suffix = "users"
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; payload?: Record<string, unknown> }>
  suffix?: string
}) {
  if (!active || !payload?.length) return null
  const data = payload[0]
  return (
    <div className="rounded-lg border bg-background p-2 shadow-sm">
      <div className="font-medium">{String(data.payload?.name || data.name || "")}</div>
      <div className="text-muted-foreground">{data.value} {suffix}</div>
    </div>
  )
}

// Custom legend component
function CustomLegend({
  payload
}: {
  payload?: Array<{ color?: string; value?: string }>
}) {
  return (
    <div className="flex flex-wrap justify-center gap-4 pt-3">
      {payload?.map((entry, index: number) => (
        <div key={index} className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 rounded-[2px]"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function SurveyAnalyticsPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["survey-stats"],
    queryFn: fetchSurveyStats,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Survey Analytics</h1>
          <p className="text-muted-foreground">Loading survey data...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Survey Analytics</h1>
          <p className="text-destructive">Failed to load survey data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Survey Analytics</h1>
        <p className="text-muted-foreground">
          Onboarding survey completion and demographic breakdown
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Registered accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Surveys Completed</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.surveyCompleted.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Completed onboarding</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Of all users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Company Users</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.userTypeDistribution.find(d => d.name === "Company")?.value || 0}
            </div>
            <p className="text-xs text-muted-foreground">Business accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* User Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>User Type Distribution</CardTitle>
            <CardDescription>Individual vs Company users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={stats.userTypeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name || ""}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {stats.userTypeDistribution.map((entry, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend content={<CustomLegend />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Company Size Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Company Size Distribution</CardTitle>
            <CardDescription>Team and organization sizes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={stats.companySizeDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill={PIE_COLORS[0]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Industry Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Top Industries</CardTitle>
            <CardDescription>Most common industry categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={stats.industryDistribution.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill={PIE_COLORS[1]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Occupation Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Occupation Distribution</CardTitle>
            <CardDescription>User roles and job functions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={stats.occupationDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {stats.occupationDistribution.map((_entry, index: number) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend content={<CustomLegend />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Survey Completion Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Survey Completions Over Time</CardTitle>
          <CardDescription>Daily survey completion trend</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={stats.completionOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value: string) => {
                    const date = new Date(value)
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }}
                />
                <YAxis />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length || !label) return null
                    const date = new Date(String(label))
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="font-medium">
                          {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="text-muted-foreground">{payload[0].value} completions</div>
                      </div>
                    )
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={PIE_COLORS[0]}
                  strokeWidth={2}
                  dot={{ fill: PIE_COLORS[0], strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
