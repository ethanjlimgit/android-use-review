"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { Badge } from "@droiduse/shared-ui/badge"
import { Button } from "@droiduse/shared-ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { format } from "date-fns"
import { ArrowLeft } from "lucide-react"
import TaskStepDisplayDetailed from "@/components/task-step-display-detailed"

type TaskStep = {
  id: string
  stepNumber: number
  agentType: string
  actions: any[] | null
  thought: string | null
  description: string | null
  subgoal: string | null
  confidence: number | null
  status: string
  error: string | null
  summary: string | null
  fullResponse: string | null
  a11yTree: any | null
  phoneState: any | null
  formattedText: string | null
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
}

type ProfilingOperation = {
  total_ms: number
  count: number
  avg_ms: number
  percentage: number
}

type ProfilingCategory = {
  total_ms: number
  percentage: number
  count: number
  avg_ms: number
  min_ms: number
  max_ms: number
  operations: Record<string, ProfilingOperation>
}

type ProfilingSummary = {
  total_time_ms: number
  tracked_time_ms: number
  untracked_time_ms: number
  categories: Record<string, ProfilingCategory>
}

type Task = {
  id: string
  goal: string
  userId: string | null
  status: string
  totalSteps: number
  isReasoning: boolean
  error: string | null
  profilingSummary: ProfilingSummary | null
  createdAt: Date
  completedAt: Date | null
  device: {
    id: string
    name: string
    deviceId: string
    status: string
    deviceType?: {
      widthPixels?: number | null
      heightPixels?: number | null
      manufacturer?: string | null
      model?: string | null
    } | null
  }
  taskSteps: TaskStep[]
}

async function fetchTask(id: string) {
  const response = await fetch(`/api/admin/tasks/${id}`)
  if (!response.ok) throw new Error("Failed to fetch task")
  const data = await response.json()
  return data.task as Task
}

function getStatusColor(status: string) {
  switch (status) {
    case "COMPLETED":
    case "SUCCESS":
      return "default"
    case "RUNNING":
    case "PENDING":
      return "secondary"
    case "FAILED":
      return "destructive"
    case "TIMED_OUT":
      return "outline"
    default:
      return "secondary"
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60000)
  const secs = ((ms % 60000) / 1000).toFixed(1)
  return `${mins}m ${secs}s`
}

const CATEGORY_COLORS: Record<string, string> = {
  llm: "bg-blue-500",
  agent: "bg-purple-500",
  sleep: "bg-yellow-500",
  network: "bg-green-500",
  other: "bg-gray-500",
}

function ProfilingSummaryCard({ summary }: { summary: ProfilingSummary }) {
  const sortedCategories = Object.entries(summary.categories).sort(
    ([, a], [, b]) => b.total_ms - a.total_ms
  )

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Profiling Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Time overview */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{formatDuration(summary.total_time_ms)}</div>
            <div className="text-xs text-muted-foreground">Total Time</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{formatDuration(summary.tracked_time_ms)}</div>
            <div className="text-xs text-muted-foreground">Tracked</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{formatDuration(summary.untracked_time_ms)}</div>
            <div className="text-xs text-muted-foreground">Untracked</div>
          </div>
        </div>

        {/* Percentage bar */}
        <div className="space-y-1.5">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {sortedCategories.map(([name, cat]) => (
              <div
                key={name}
                className={`${CATEGORY_COLORS[name] || "bg-gray-400"} transition-all`}
                style={{ width: `${cat.percentage}%` }}
                title={`${name}: ${cat.percentage}%`}
              />
            ))}
            {summary.untracked_time_ms > 0 && summary.total_time_ms > 0 && (
              <div
                className="bg-muted-foreground/20"
                style={{
                  width: `${(summary.untracked_time_ms / summary.total_time_ms) * 100}%`,
                }}
                title={`untracked: ${((summary.untracked_time_ms / summary.total_time_ms) * 100).toFixed(1)}%`}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {sortedCategories.map(([name, cat]) => (
              <span key={name} className="flex items-center gap-1">
                <span className={`inline-block h-2 w-2 rounded-full ${CATEGORY_COLORS[name] || "bg-gray-400"}`} />
                {name} {cat.percentage}%
              </span>
            ))}
            {summary.untracked_time_ms > 0 && summary.total_time_ms > 0 && (
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/20" />
                untracked {((summary.untracked_time_ms / summary.total_time_ms) * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="space-y-3">
          {sortedCategories.map(([name, cat]) => {
            const sortedOps = Object.entries(cat.operations).sort(
              ([, a], [, b]) => b.total_ms - a.total_ms
            )
            return (
              <div key={name} className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${CATEGORY_COLORS[name] || "bg-gray-400"}`} />
                    <span className="font-medium capitalize">{name}</span>
                  </div>
                  <span className="text-sm font-mono">
                    {formatDuration(cat.total_ms)}
                    <span className="text-muted-foreground ml-1">({cat.percentage}%)</span>
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {cat.count} calls &middot; avg {formatDuration(cat.avg_ms)}
                  {cat.min_ms > 0 && <> &middot; min {formatDuration(cat.min_ms)}</>}
                  {cat.max_ms > 0 && <> &middot; max {formatDuration(cat.max_ms)}</>}
                </div>
                {sortedOps.length > 0 && (
                  <div className="space-y-1">
                    {sortedOps.map(([opName, op]) => (
                      <div key={opName} className="flex items-center justify-between text-xs">
                        <span className="font-mono text-muted-foreground truncate mr-2">{opName}</span>
                        <span className="font-mono whitespace-nowrap">
                          {formatDuration(op.total_ms)}
                          <span className="text-muted-foreground"> x{op.count}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default function TaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const taskId = params.id as string

  const { data: task, isLoading } = useQuery({
    queryKey: ["admin-task", taskId],
    queryFn: () => fetchTask(taskId),
  })

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!task) {
    return <div>Task not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/tasks")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tasks
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">Task Details</h1>
        <p className="text-muted-foreground">View task information and execution steps</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Task Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Goal</div>
              <div className="mt-1">{task.goal}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Status</div>
              <div className="mt-1">
                <Badge variant={getStatusColor(task.status) as any}>
                  {task.status}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Total Steps</div>
              <div className="mt-1">{task.totalSteps}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Reasoning Mode</div>
              <div className="mt-1">{task.isReasoning ? "Yes" : "No"}</div>
            </div>
            {task.error && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Error</div>
                <div className="mt-1 text-red-500 text-sm">{task.error}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Device Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Device Name</div>
              <div className="mt-1">{task.device.name}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Device ID</div>
              <div className="mt-1 font-mono text-sm">{task.device.deviceId}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Device Status</div>
              <div className="mt-1">
                <Badge variant={task.device.status === "online" ? "default" : "secondary"}>
                  {task.device.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Created</div>
                <div className="mt-1">{format(new Date(task.createdAt), "MMM d, yyyy HH:mm:ss")}</div>
              </div>
              {task.completedAt && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Completed</div>
                  <div className="mt-1">{format(new Date(task.completedAt), "MMM d, yyyy HH:mm:ss")}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {task.profilingSummary && (
        <ProfilingSummaryCard summary={task.profilingSummary} />
      )}

      <div>
        <div className="mb-4">
          <h2 className="text-2xl font-bold">Task Steps ({task.taskSteps.length})</h2>
          <p className="text-muted-foreground">Detailed execution steps for this task</p>
        </div>
        {task.taskSteps.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No steps recorded
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {task.taskSteps.map((step) => (
              <TaskStepDisplayDetailed key={step.id} step={step} device={task.device} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
