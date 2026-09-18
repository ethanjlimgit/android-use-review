"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Button } from "@droiduse/shared-ui/button"
import { Badge } from "@droiduse/shared-ui/badge"
import { Plus, FolderKanban, Loader2 } from "lucide-react"

interface Project {
  id: string
  name: string
  slug: string
  enabled: boolean
  createdAt: string
  _count?: {
    contacts: number
    emailCampaigns: number
    apiKeys: number
  }
}

export default function ProjectsPage() {
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
        Failed to load projects
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage your email marketing projects
          </p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {projects && projects.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No projects yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Create your first project to start sending emails
            </p>
            <Link href="/dashboard/projects/new">
              <Button>
                <Plus className="h-4 w-4" />
                Create Project
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects?.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
            >
              <Card className="border-card-border hover:border-primary/30 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <Badge variant={project.enabled ? "default" : "secondary"}>
                      {project.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {project.slug}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>{project._count?.contacts ?? 0} contacts</span>
                    <span>{project._count?.emailCampaigns ?? 0} campaigns</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
