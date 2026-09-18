"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Button } from "@droiduse/shared-ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Input } from "@droiduse/shared-ui/input"
import { Label } from "@droiduse/shared-ui/label"
import { Badge } from "@droiduse/shared-ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@droiduse/shared-ui/dialog"
import {
  ArrowLeft,
  Plus,
  Trash2,
  Filter,
  Loader2,
  X,
} from "lucide-react"
import { format } from "date-fns"

const FIELD_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "country", label: "Country" },
  { value: "city", label: "City" },
  { value: "timezone", label: "Timezone" },
  { value: "source", label: "Source" },
]

const OPERATOR_OPTIONS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "in", label: "in" },
  { value: "not_in", label: "not in" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "gte", label: "greater or equal" },
  { value: "lte", label: "less or equal" },
]

interface SegmentFilter {
  field: string
  operator: string
  value: string
}

interface Segment {
  id: string
  name: string
  description: string | null
  filters: SegmentFilter[]
  createdAt: string
}

export default function SegmentsPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [segmentName, setSegmentName] = useState("")
  const [segmentDescription, setSegmentDescription] = useState("")
  const [filters, setFilters] = useState<SegmentFilter[]>([
    { field: "email", operator: "contains", value: "" },
  ])

  const { data: segments, isLoading, error } = useQuery<Segment[]>({
    queryKey: ["segments", projectId],
    queryFn: async () => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/segments`
      )
      if (!res.ok) throw new Error("Failed to fetch segments")
      return res.json()
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/segments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: segmentName,
            description: segmentDescription || null,
            filters: filters.map((f) => ({
              field: f.field,
              operator: f.operator,
              value: f.value,
            })),
          }),
        }
      )
      if (!res.ok) throw new Error("Failed to create segment")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments", projectId] })
      setDialogOpen(false)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (segmentId: string) => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/segments/${segmentId}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("Failed to delete segment")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments", projectId] })
    },
  })

  function resetForm() {
    setSegmentName("")
    setSegmentDescription("")
    setFilters([{ field: "email", operator: "contains", value: "" }])
  }

  function addFilter() {
    setFilters((prev) => [
      ...prev,
      { field: "email", operator: "contains", value: "" },
    ])
  }

  function removeFilter(index: number) {
    setFilters((prev) => prev.filter((_, i) => i !== index))
  }

  function updateFilter(
    index: number,
    key: keyof SegmentFilter,
    value: string
  ) {
    setFilters((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [key]: value } : f))
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/projects/${projectId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Segments</h1>
          <p className="text-muted-foreground text-sm">
            Create dynamic audience segments with filters
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              New Segment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Segment</DialogTitle>
              <DialogDescription>Define filters to target specific contacts.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                createMutation.mutate()
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="segName">Segment Name</Label>
                <Input
                  id="segName"
                  placeholder="e.g., US Subscribers"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="segDesc">Description (optional)</Label>
                <Input
                  id="segDesc"
                  placeholder="Brief description"
                  value={segmentDescription}
                  onChange={(e) => setSegmentDescription(e.target.value)}
                />
              </div>

              {/* Filter Builder */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Filters</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addFilter}
                  >
                    <Plus className="h-4 w-4" />
                    Add Filter
                  </Button>
                </div>

                {filters.map((filter, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-3 bg-muted/50 rounded-md"
                  >
                    <div className="flex-1">
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={filter.field}
                        onChange={(e) =>
                          updateFilter(index, "field", e.target.value)
                        }
                      >
                        {FIELD_OPTIONS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                        <option value="metadata.*">
                          metadata.* (custom)
                        </option>
                      </select>
                    </div>
                    {filter.field === "metadata.*" && (
                      <Input
                        placeholder="metadata.key"
                        className="w-36"
                        onChange={(e) =>
                          updateFilter(
                            index,
                            "field",
                            `metadata.${e.target.value}`
                          )
                        }
                      />
                    )}
                    <div className="w-36">
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={filter.operator}
                        onChange={(e) =>
                          updateFilter(index, "operator", e.target.value)
                        }
                      >
                        {OPERATOR_OPTIONS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Input
                      placeholder="Value"
                      className="flex-1"
                      value={filter.value}
                      onChange={(e) =>
                        updateFilter(index, "value", e.target.value)
                      }
                      required
                    />
                    {filters.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => removeFilter(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Create Segment
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="p-4 text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md">
          Failed to load segments
        </div>
      ) : segments && segments.length > 0 ? (
        <div className="space-y-3">
          {segments.map((segment) => (
            <Card key={segment.id} className="border-card-border">
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-primary" />
                    <span className="font-medium">{segment.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {segment.filters?.length ?? 0} filter
                      {(segment.filters?.length ?? 0) !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  {segment.description && (
                    <p className="text-xs text-muted-foreground ml-6">
                      {segment.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground ml-6">
                    Created{" "}
                    {format(new Date(segment.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (
                      confirm("Delete this segment? This cannot be undone.")
                    ) {
                      deleteMutation.mutate(segment.id)
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Filter className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium mb-2">No segments yet</h3>
            <p className="text-sm text-muted-foreground">
              Create a segment to target specific contacts
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
