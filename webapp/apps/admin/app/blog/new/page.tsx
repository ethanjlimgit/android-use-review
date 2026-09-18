"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import { Button } from "@droiduse/shared-ui/button"
import { Input } from "@droiduse/shared-ui/input"
import { Label } from "@droiduse/shared-ui/label"
import { Textarea } from "@droiduse/shared-ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@droiduse/shared-ui/select"
import { Switch } from "@droiduse/shared-ui/switch"
import { useToast } from "@droiduse/shared-ui/use-toast"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import "@uiw/react-md-editor/markdown-editor.css"

// Dynamically import MDEditor to avoid SSR issues
const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default),
  { ssr: false }
)

async function createBlogPost(data: {
  title: string
  slug: string
  excerpt: string | null
  content: string
  authorId: string
  status: "draft" | "published" | "archived"
  featured: boolean
  seoTitle?: string | null
  seoDescription?: string | null
  seoKeywords?: string | null
}) {
  const response = await fetch("/api/admin/blog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to create blog post")
  }
  return response.json()
}

async function updateBlogPost(slug: string, data: {
  title: string
  slug: string
  excerpt: string | null
  content: string
  status: "draft" | "published" | "archived"
  featured: boolean
  seoTitle?: string | null
  seoDescription?: string | null
  seoKeywords?: string | null
}) {
  const response = await fetch(`/api/admin/blog/${slug}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to update blog post")
  }
  return response.json()
}

async function fetchBlogPost(slug: string) {
  const response = await fetch(`/api/admin/blog/${slug}?includeContent=true`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to fetch blog post")
  }
  return response.json()
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function NewBlogPostContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const editSlug = searchParams.get("slug")
  const isEditMode = !!editSlug

  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [content, setContent] = useState("")
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft")
  const [featured, setFeatured] = useState(false)
  const [seoTitle, setSeoTitle] = useState("")
  const [seoDescription, setSeoDescription] = useState("")
  const [seoKeywords, setSeoKeywords] = useState("")
  const [authorId, setAuthorId] = useState<string>("")

  // Fetch existing blog post if editing
  const { data: existingPost, isLoading: loadingPost } = useQuery({
    queryKey: ["blog-post", editSlug],
    queryFn: () => fetchBlogPost(editSlug!),
    enabled: isEditMode && !!editSlug,
  })

  // Populate form when existing post is loaded
  useEffect(() => {
    if (existingPost) {
      setTitle(existingPost.title || "")
      setSlug(existingPost.slug || "")
      setExcerpt(existingPost.excerpt || "")
      setContent(existingPost.content || "")
      setStatus(existingPost.status || "draft")
      setFeatured(existingPost.featured || false)
      setSeoTitle(existingPost.seoTitle || "")
      setSeoDescription(existingPost.seoDescription || "")
      setSeoKeywords(existingPost.seoKeywords || "")
      if (existingPost.authorId) {
        setAuthorId(existingPost.authorId)
      }
    }
  }, [existingPost])

  // Get current user session
  useEffect(() => {
    async function getSession() {
      try {
        const response = await fetch("/api/auth/session")
        const session = await response.json()
        if (session?.user?.id) {
          setAuthorId(session.user.id)
        }
      } catch (error) {
        console.error("Failed to get session:", error)
      }
    }
    getSession()
  }, [])

  const createMutation = useMutation({
    mutationFn: createBlogPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] })
      toast({
        title: "Success",
        description: "Blog post created successfully",
      })
      router.push("/blog")
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create blog post",
        variant: "destructive",
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateBlogPost>[1]) => updateBlogPost(editSlug!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] })
      queryClient.invalidateQueries({ queryKey: ["blog-post", editSlug] })
      toast({
        title: "Success",
        description: "Blog post updated successfully",
      })
      router.push("/blog")
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update blog post",
        variant: "destructive",
      })
    },
  })

  const mutation = isEditMode ? updateMutation : createMutation

  const handleTitleChange = (value: string) => {
    setTitle(value)
    if (!slug || slug === generateSlug(title)) {
      setSlug(generateSlug(value))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isEditMode) {
      updateMutation.mutate({
        title,
        slug,
        excerpt: excerpt || null,
        content,
        status,
        featured,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        seoKeywords: seoKeywords || null,
      })
    } else {
      if (!authorId) {
        toast({
          title: "Error",
          description: "Unable to get user session. Please refresh the page.",
          variant: "destructive",
        })
        return
      }

      createMutation.mutate({
        title,
        slug,
        excerpt: excerpt || null,
        content,
        authorId,
        status,
        featured,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        seoKeywords: seoKeywords || null,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/blog">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {isEditMode ? "Edit Blog Post" : "Create New Blog Post"}
          </h1>
          <p className="text-muted-foreground">
            {isEditMode ? "Update your blog post" : "Write and publish a new blog post"}
          </p>
        </div>
      </div>

      {loadingPost ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Loading blog post...</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
            <CardDescription>Write your blog post content</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Enter blog post title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="blog-post-slug"
                required
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier (lowercase, hyphens only)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt</Label>
              <Textarea
                id="excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Brief description of the post"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content *</Label>
              <div data-color-mode="light">
                <MDEditor
                  value={content}
                  onChange={(value) => setContent(value || "")}
                  preview="edit"
                  hideToolbar={false}
                  visibleDragbar={false}
                  height={500}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Configure post settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value: "draft" | "published" | "archived") => setStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="featured">Featured</Label>
                <p className="text-sm text-muted-foreground">
                  Highlight this post on the homepage
                </p>
              </div>
              <Switch
                id="featured"
                checked={featured}
                onCheckedChange={setFeatured}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SEO</CardTitle>
            <CardDescription>Search engine optimization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="seoTitle">SEO Title</Label>
              <Input
                id="seoTitle"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Custom title for search engines"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seoDescription">SEO Description</Label>
              <Textarea
                id="seoDescription"
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder="Meta description for search engines"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seoKeywords">SEO Keywords</Label>
              <Input
                id="seoKeywords"
                value={seoKeywords}
                onChange={(e) => setSeoKeywords(e.target.value)}
                placeholder="Comma-separated keywords"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/blog">Cancel</Link>
          </Button>
          <Button type="submit" disabled={mutation.isPending || loadingPost}>
            <Save className="mr-2 h-4 w-4" />
            {mutation.isPending 
              ? (isEditMode ? "Updating..." : "Creating...") 
              : (isEditMode ? "Update Post" : "Create Post")}
          </Button>
        </div>
      </form>
      )}
    </div>
  )
}

export default function NewBlogPostPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/blog">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Loading...</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading blog post editor...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <NewBlogPostContent />
    </Suspense>
  )
}

