"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { FolderKanban, Users, Send, Loader2 } from "lucide-react"

interface Project {
  id: string
  name: string
  slug: string
  enabled: boolean
  _count?: {
    contacts: number
    emailCampaigns: number
  }
}

export default function DashboardPage() {
  const { data: projects, isLoading, error } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/internal/projects")
      if (!res.ok) throw new Error("Failed to fetch projects")
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md">
        Failed to load dashboard data
      </div>
    )
  }

  const projectCount = projects?.length ?? 0
  const totalContacts =
    projects?.reduce((sum, p) => sum + (p._count?.contacts ?? 0), 0) ?? 0
  const totalCampaigns =
    projects?.reduce((sum, p) => sum + (p._count?.emailCampaigns ?? 0), 0) ?? 0

  const stats = [
    {
      label: "Projects",
      value: projectCount,
      icon: FolderKanban,
      description: "Total projects",
    },
    {
      label: "Contacts",
      value: totalContacts,
      icon: Users,
      description: "Across all projects",
    },
    {
      label: "Campaigns",
      value: totalCampaigns,
      icon: Send,
      description: "Across all projects",
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your email marketing service
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="border-card-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
