"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@droiduse/shared-ui/card"
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts"
import {
  Users,
  UserCheck,
  TrendingUp,
  Coins,
  Globe,
  Activity,
  Award,
} from "lucide-react"
import { useMemo, useState } from "react"

// Country code to name mapping for tooltips
const countryNames: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  JP: "Japan",
  CN: "China",
  IN: "India",
  BR: "Brazil",
  MX: "Mexico",
  KR: "South Korea",
  IT: "Italy",
  ES: "Spain",
  NL: "Netherlands",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  PL: "Poland",
  RU: "Russia",
  UA: "Ukraine",
  SG: "Singapore",
  HK: "Hong Kong",
  TW: "Taiwan",
  ID: "Indonesia",
  TH: "Thailand",
  VN: "Vietnam",
  PH: "Philippines",
  MY: "Malaysia",
  NZ: "New Zealand",
  ZA: "South Africa",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  IL: "Israel",
  TR: "Turkey",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  PE: "Peru",
  EG: "Egypt",
  NG: "Nigeria",
  KE: "Kenya",
  PK: "Pakistan",
  BD: "Bangladesh",
  IE: "Ireland",
  AT: "Austria",
  CH: "Switzerland",
  BE: "Belgium",
  PT: "Portugal",
  CZ: "Czech Republic",
  RO: "Romania",
  HU: "Hungary",
  GR: "Greece",
}

// ISO Alpha-2 to ISO Alpha-3 mapping for the map
const alpha2ToAlpha3: Record<string, string> = {
  US: "USA", GB: "GBR", CA: "CAN", AU: "AUS", DE: "DEU", FR: "FRA",
  JP: "JPN", CN: "CHN", IN: "IND", BR: "BRA", MX: "MEX", KR: "KOR",
  IT: "ITA", ES: "ESP", NL: "NLD", SE: "SWE", NO: "NOR", DK: "DNK",
  FI: "FIN", PL: "POL", RU: "RUS", UA: "UKR", SG: "SGP", HK: "HKG",
  TW: "TWN", ID: "IDN", TH: "THA", VN: "VNM", PH: "PHL", MY: "MYS",
  NZ: "NZL", ZA: "ZAF", AE: "ARE", SA: "SAU", IL: "ISR", TR: "TUR",
  AR: "ARG", CL: "CHL", CO: "COL", PE: "PER", EG: "EGY", NG: "NGA",
  KE: "KEN", PK: "PAK", BD: "BGD", IE: "IRL", AT: "AUT", CH: "CHE",
  BE: "BEL", PT: "PRT", CZ: "CZE", RO: "ROU", HU: "HUN", GR: "GRC",
}

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"]

interface UserStats {
  overview: {
    totalUsers: number
    activeUsers: number
    bannedUsers: number
    verifiedUsers: number
    weeklyActiveUsers: number
    monthlyActiveUsers: number
  }
  geoDistribution: { country: string; count: number }[]
  userAcquisition: { date: string; newUsers: number; cumulative: number }[]
  creditStats: {
    totalUsed: number
    totalAllowance: number
    totalBonusCredits: number
    avgUsed: number
    avgAllowance: number
    maxUsed: number
  }
  creditDistribution: { range: string; count: number }[]
  subscriptionDistribution: { tier: string; count: number }[]
  authProviderDistribution: { provider: string; count: number }[]
  referralStats: {
    totalReferrals: number
    usersWithReferralCode: number
    usersWithReferrals: number
  }
}

async function fetchUserStats(): Promise<UserStats> {
  const response = await fetch("/api/admin/user-stats")
  if (!response.ok) {
    throw new Error("Failed to fetch user stats")
  }
  return response.json()
}

// Custom tooltip component
function CustomTooltip({
  active,
  payload,
  labelKey = "name",
  suffix = "users"
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; payload?: Record<string, unknown> }>
  labelKey?: string
  suffix?: string
}) {
  if (!active || !payload?.length) return null
  const data = payload[0]
  const label = data.payload?.[labelKey] || data.name || ""
  return (
    <div className="rounded-lg border bg-background p-2 shadow-sm">
      <div className="font-medium capitalize">{String(label)}</div>
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
          <span className="text-sm capitalize">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function UserStatsPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["user-stats"],
    queryFn: fetchUserStats,
  })

  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null)

  // Create a map of country codes to user counts
  const countryData = useMemo(() => {
    if (!stats) return {}
    const data: Record<string, number> = {}
    stats.geoDistribution.forEach((item) => {
      const alpha3 = alpha2ToAlpha3[item.country]
      if (alpha3) {
        data[alpha3] = item.count
      }
    })
    return data
  }, [stats])

  // Get max count for color scaling
  const maxCount = useMemo(() => {
    if (!stats?.geoDistribution.length) return 1
    return Math.max(...stats.geoDistribution.map((d) => d.count))
  }, [stats])

  // Color scale function
  const getColor = (count: number) => {
    if (count === 0) return "#1e293b"
    const intensity = Math.pow(count / maxCount, 0.5) // Square root for better distribution
    const r = Math.round(99 + (99 - 99) * intensity)
    const g = Math.round(102 + (102 - 102) * intensity)
    const b = Math.round(241 * intensity)
    return `rgb(${r}, ${g}, ${b})`
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">User Statistics</h1>
          <p className="text-muted-foreground">Loading user data...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
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
          <h1 className="text-3xl font-bold">User Statistics</h1>
          <p className="text-destructive">Failed to load user data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Statistics</h1>
        <p className="text-muted-foreground">
          Comprehensive user analytics and demographics
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
            <div className="text-2xl font-bold">{stats.overview.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.overview.verifiedUsers.toLocaleString()} verified
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.activeUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.overview.bannedUsers} banned
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Active</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.weeklyActiveUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {((stats.overview.weeklyActiveUsers / stats.overview.totalUsers) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Active</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.monthlyActiveUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {((stats.overview.monthlyActiveUsers / stats.overview.totalUsers) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Credit Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credits Used</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.creditStats.totalUsed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              of {stats.creditStats.totalAllowance.toLocaleString()} allowance
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Credits Used</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.creditStats.avgUsed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              avg allowance: {stats.creditStats.avgAllowance.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bonus Credits</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.creditStats.totalBonusCredits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">from referrals</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.referralStats.totalReferrals.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.referralStats.usersWithReferrals} users referred others
            </p>
          </CardContent>
        </Card>
      </div>

      {/* World Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            User Geographic Distribution
          </CardTitle>
          <CardDescription>
            Users by country ({stats.geoDistribution.length} countries)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full bg-slate-900 rounded-lg overflow-hidden relative">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                scale: 120,
                center: [0, 30],
              }}
            >
              <ZoomableGroup>
                <Geographies geography={GEO_URL}>
                  {({ geographies }: { geographies: Array<{ rsmKey: string; properties: Record<string, string>; id: string }> }) =>
                    geographies.map((geo) => {
                      const countryCode = geo.properties.ISO_A3 || geo.id
                      const count = countryData[countryCode] || 0

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={count > 0 ? getColor(count) : "#1e293b"}
                          stroke="#334155"
                          strokeWidth={0.5}
                          style={{
                            default: {
                              outline: "none",
                              transition: "all 0.2s",
                            },
                            hover: {
                              fill: count > 0 ? "#818cf8" : "#334155",
                              outline: "none",
                              cursor: count > 0 ? "pointer" : "default",
                            },
                            pressed: {
                              outline: "none",
                            },
                          }}
                          onMouseEnter={() => setHoveredCountry(countryCode)}
                          onMouseLeave={() => setHoveredCountry(null)}
                        />
                      )
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>
            {hoveredCountry && countryData[hoveredCountry] && (
              <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur px-3 py-2 rounded-lg border">
                <div className="font-medium">{hoveredCountry}</div>
                <div className="text-sm text-muted-foreground">
                  {countryData[hoveredCountry].toLocaleString()} users
                </div>
              </div>
            )}
          </div>
          {/* Top Countries List */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {stats.geoDistribution.slice(0, 12).map((item) => (
              <div
                key={item.country}
                className="flex items-center justify-between p-2 bg-muted/50 rounded"
              >
                <span className="text-sm font-medium">
                  {countryNames[item.country] || item.country}
                </span>
                <span className="text-sm text-muted-foreground">{item.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Acquisition Chart */}
      <Card>
        <CardHeader>
          <CardTitle>User Acquisition Over Time</CardTitle>
          <CardDescription>New users and cumulative growth (last 90 days)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={stats.userAcquisition}>
                <defs>
                  <linearGradient id="colorNewUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value: string) => {
                    const date = new Date(value)
                    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }}
                  interval={13}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length || !label) return null
                    const date = new Date(String(label))
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="font-medium">
                          {date.toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          New users: {payload[0]?.value}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Total: {Number(payload[1]?.value || 0).toLocaleString()}
                        </div>
                      </div>
                    )
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="newUsers"
                  stroke="#6366f1"
                  fill="url(#colorNewUsers)"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
                <Legend
                  content={() => (
                    <div className="flex justify-center gap-6 pt-3">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded bg-indigo-500" />
                        <span className="text-sm">New Users</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-0.5 w-4 bg-green-500" />
                        <span className="text-sm">Cumulative Total</span>
                      </div>
                    </div>
                  )}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Credit Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Credit Usage Distribution</CardTitle>
            <CardDescription>Users grouped by credits used</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={stats.creditDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip labelKey="range" suffix="users" />} />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Tiers</CardTitle>
            <CardDescription>Users by subscription plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={stats.subscriptionDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="tier"
                    label={({ name, percent }) => `${name || ""}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {stats.subscriptionDistribution.map((_entry, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip labelKey="tier" />} />
                  <Legend content={<CustomLegend />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Auth Provider Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Authentication Providers</CardTitle>
          <CardDescription>How users sign in to the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={stats.authProviderDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis
                  dataKey="provider"
                  type="category"
                  width={80}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value: string) => value.charAt(0).toUpperCase() + value.slice(1)}
                />
                <Tooltip content={<CustomTooltip labelKey="provider" />} />
                <Bar dataKey="count" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
