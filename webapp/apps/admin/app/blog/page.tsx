"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { DataTable } from "@/components/data-table"
import { Badge } from "@droiduse/shared-ui/badge"
import { Button } from "@droiduse/shared-ui/button"
import { format } from "date-fns"
import { Edit, Trash2, Plus } from "lucide-react"
import Link from "next/link"

type BlogPost = {
  id: string
  title: string
  slug: string
  status: string
  featured: boolean
  author: { name: string | null; email: string | null } | null
  publishedAt: Date | null
  createdAt: Date
}

const PAGE_SIZE = 20

async function fetchBlogPosts(filters?: { status?: string; search?: string; page?: number }) {
  const params = new URLSearchParams()
  if (filters?.status) params.append("status", filters.status)
  if (filters?.search) params.append("search", filters.search)
  const page = filters?.page || 1
  params.append("limit", String(PAGE_SIZE))
  params.append("offset", String((page - 1) * PAGE_SIZE))

  const response = await fetch(`/api/admin/blog?${params}`)
  if (!response.ok) throw new Error("Failed to fetch blog posts")
  return response.json() as Promise<{ posts: BlogPost[]; total: number }>
}

export default function BlogPostsPage() {
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-blog-posts", statusFilter, search, page],
    queryFn: () => fetchBlogPosts({ status: statusFilter || undefined, search: search || undefined, page }),
  })

  const posts = data?.posts ?? []
  const total = data?.total ?? 0

  const columns = [
    {
      key: "title",
      header: "Title",
      render: (post: BlogPost) => (
        <div>
          <div className="font-medium">{post.title}</div>
          <div className="text-sm text-muted-foreground">{post.slug}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (post: BlogPost) => (
        <Badge variant={post.status === "published" ? "default" : "secondary"}>
          {post.status}
        </Badge>
      ),
    },
    {
      key: "featured",
      header: "Featured",
      render: (post: BlogPost) => (
        <Badge variant={post.featured ? "default" : "outline"}>
          {post.featured ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "author",
      header: "Author",
      render: (post: BlogPost) => post.author?.name || post.author?.email || "Unknown",
    },
    {
      key: "publishedAt",
      header: "Published",
      render: (post: BlogPost) =>
        post.publishedAt ? format(new Date(post.publishedAt), "MMM d, yyyy") : "Draft",
    },
    {
      key: "actions",
      header: "Actions",
      render: (post: BlogPost) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/blog/new?slug=${post.slug}`}>
              <Edit className="h-4 w-4" />
            </Link>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Blog Posts</h1>
          <p className="text-muted-foreground">Manage all blog posts</p>
        </div>
        <Button asChild>
          <Link href="/blog/new">
            <Plus className="mr-2 h-4 w-4" />
            Create New Post
          </Link>
        </Button>
      </div>

      <DataTable
        data={posts}
        columns={columns}
        searchable
        searchPlaceholder="Search posts..."
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        filterable
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "", label: "All" },
              { value: "draft", label: "Draft" },
              { value: "published", label: "Published" },
              { value: "archived", label: "Archived" },
            ],
          },
        ]}
        onFilterChange={(filters) => { setStatusFilter(filters.status || ""); setPage(1) }}
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

