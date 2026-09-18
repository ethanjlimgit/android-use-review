"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Button } from "@droiduse/shared-ui/button"
import { Badge } from "@droiduse/shared-ui/badge"
import {
  Users,
  Send,
  Key,
  Settings,
  ArrowLeft,
  Loader2,
  BookUser,
  Filter,
} from "lucide-react"
import { format } from "date-fns"

interface Project {
  id: string
  name: string
  slug: string
  enabled: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    contacts: number
    emailCampaigns: number
    apiKeys: number
  }
}

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId

  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/internal/projects/${projectId}`)
      if (!res.ok) throw new Error("Failed to fetch project")
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

  if (error || !project) {
    return (
      <div className="p-4 text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md">
        Failed to load project
      </div>
    )
  }

  const subPages = [
    {
      label: "Contacts",
      href: `/dashboard/projects/${projectId}/contacts`,
      icon: Users,
      count: project._count?.contacts ?? 0,
      description: "Manage contacts and subscribers",
    },
    {
      label: "Campaigns",
      href: `/dashboard/projects/${projectId}/campaigns`,
      icon: Send,
      count: project._count?.emailCampaigns ?? 0,
      description: "Create and manage email campaigns",
    },
    {
      label: "Contact Lists",
      href: `/dashboard/projects/${projectId}/contacts/lists`,
      icon: BookUser,
      description: "Organize contacts into lists",
    },
    {
      label: "Segments",
      href: `/dashboard/projects/${projectId}/segments`,
      icon: Filter,
      description: "Define dynamic audience segments",
    },
    {
      label: "Settings",
      href: `/dashboard/projects/${projectId}/settings`,
      icon: Settings,
      description: "API keys, senders, project config",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <Badge variant={project.enabled ? "default" : "secondary"}>
              {project.enabled ? "Active" : "Disabled"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono">
            {project.slug}
          </p>
        </div>
        <Link href={`/dashboard/projects/${projectId}/settings`}>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Contacts
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(project._count?.contacts ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Campaigns
            </CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(project._count?.emailCampaigns ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              API Keys
            </CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(project._count?.apiKeys ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Manage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subPages.map((page) => {
            const Icon = page.icon
            return (
              <Link key={page.href} href={page.href}>
                <Card className="border-card-border hover:border-primary/30 transition-colors cursor-pointer h-full">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Icon className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-medium">
                          {page.label}
                          {"count" in page && (
                            <span className="ml-2 text-muted-foreground text-sm font-normal">
                              ({page.count})
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {page.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Created {format(new Date(project.createdAt), "MMM d, yyyy")}
      </div>
    </div>
  )
}
