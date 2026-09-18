"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { DataTable } from "@/components/data-table"
import { Badge } from "@droiduse/shared-ui/badge"
import { Button } from "@droiduse/shared-ui/button"
import { format } from "date-fns"
import { Edit, Trash2 } from "lucide-react"

type Skill = {
  id: string
  title: string
  description: string
  type: string
  score: number
  downloads: number
  featured: boolean
  createdAt: Date
  app: { name: string } | null
}

const PAGE_SIZE = 20

async function fetchSkills(filters?: { search?: string; type?: string; featured?: string; page?: number }) {
  const params = new URLSearchParams()
  if (filters?.search) params.append("search", filters.search)
  if (filters?.type) params.append("type", filters.type)
  if (filters?.featured !== undefined) params.append("featured", filters.featured)
  const page = filters?.page || 1
  params.append("limit", String(PAGE_SIZE))
  params.append("offset", String((page - 1) * PAGE_SIZE))

  const response = await fetch(`/api/admin/skills?${params}`)
  if (!response.ok) throw new Error("Failed to fetch skills")
  return response.json() as Promise<{ skills: Skill[]; total: number }>
}

export default function SkillsPage() {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [featuredFilter, setFeaturedFilter] = useState("")
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-skills", search, typeFilter, featuredFilter, page],
    queryFn: () => fetchSkills({
      search: search || undefined,
      type: typeFilter || undefined,
      featured: featuredFilter || undefined,
      page,
    }),
  })

  const skills = data?.skills ?? []
  const total = data?.total ?? 0

  const columns = [
    {
      key: "title",
      header: "Title",
      render: (item: Skill) => (
        <div>
          <div className="font-medium">{item.title}</div>
          <div className="text-sm text-muted-foreground line-clamp-1">{item.description}</div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (item: Skill) => (
        <Badge variant="outline">{item.type}</Badge>
      ),
    },
    {
      key: "app",
      header: "App",
      render: (item: Skill) => item.app?.name || "N/A",
    },
    {
      key: "score",
      header: "Score",
      render: (item: Skill) => item.score,
    },
    {
      key: "downloads",
      header: "Downloads",
      render: (item: Skill) => item.downloads.toLocaleString(),
    },
    {
      key: "featured",
      header: "Featured",
      render: (item: Skill) => (
        <Badge variant={item.featured ? "default" : "outline"}>
          {item.featured ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (item: Skill) => format(new Date(item.createdAt), "MMM d, yyyy"),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: Skill) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Skills</h1>
        <p className="text-muted-foreground">Manage skill entries</p>
      </div>

      <DataTable
        data={skills}
        columns={columns}
        searchable
        searchPlaceholder="Search skills..."
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        filterable
        filters={[
          {
            key: "type",
            label: "Type",
            options: [
              { value: "", label: "All Types" },
              { value: "app", label: "App" },
              { value: "ai_skill", label: "AI Skill" },
            ],
          },
          {
            key: "featured",
            label: "Featured",
            options: [
              { value: "", label: "All" },
              { value: "true", label: "Featured" },
              { value: "false", label: "Not Featured" },
            ],
          },
        ]}
        onFilterChange={(filters) => {
          setTypeFilter(filters.type || "")
          setFeaturedFilter(filters.featured || "")
          setPage(1)
        }}
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total,
          onPageChange: setPage,
        }}
      />
    </div>
  )
}
