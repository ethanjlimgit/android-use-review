"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@droiduse/shared-ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Input } from "@droiduse/shared-ui/input"
import { Label } from "@droiduse/shared-ui/label"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export default function NewProjectPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function handleNameChange(value: string) {
    setName(value)
    if (!slugManuallyEdited) {
      setSlug(slugify(value))
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value)
    setSlugManuallyEdited(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/internal/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to create project")
        return
      }

      const project = await res.json()
      router.push(`/dashboard/projects/${project.id}`)
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Project</h1>
          <p className="text-muted-foreground text-sm">
            Create a new email marketing project
          </p>
        </div>
      </div>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                placeholder="My Email Project"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                placeholder="my-email-project"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                title="Lowercase alphanumeric with hyphens"
                required
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier. Auto-generated from name.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Project
              </Button>
              <Link href="/dashboard/projects">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
