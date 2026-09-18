"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { DataTable } from "@/components/data-table"
import { Badge } from "@droiduse/shared-ui/badge"
import { format } from "date-fns"

type Task = {
  id: string
  goal: string
  userId: string | null
  status: string
  totalSteps: number
  isReplay: boolean
  replaySourceId: string | null
  createdAt: Date
  completedAt: Date | null
  error: string | null
  device: {
    id: string
    name: string
    deviceId: string
  }
  user: {
    id: string
    name: string | null
    email: string | null
  } | null
  _count: {
    taskSteps: number
  }
}

const PAGE_SIZE = 20

async function fetchTasks(filters?: { search?: string; status?: string; page?: number }) {
  const params = new URLSearchParams()
  if (filters?.search) params.append("search", filters.search)
  if (filters?.status) params.append("status", filters.status)
  const page = filters?.page || 1
  params.append("limit", String(PAGE_SIZE))
  params.append("offset", String((page - 1) * PAGE_SIZE))

  const response = await fetch(`/api/admin/tasks?${params}`)
  if (!response.ok) throw new Error("Failed to fetch tasks")
  return response.json() as Promise<{ tasks: Task[]; total: number }>
}

function getStatusColor(status: string) {
  switch (status) {
    case "COMPLETED":
      return "default"
    case "RUNNING":
      return "secondary"
    case "FAILED":
      return "destructive"
    case "TIMED_OUT":
      return "outline"
    default:
      return "secondary"
  }
}

export default function TasksPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tasks", search, statusFilter, page],
    queryFn: () => fetchTasks({
      search: search || undefined,
      status: statusFilter || undefined,
      page,
    }),
  })

  const tasks = data?.tasks ?? []
  const total = data?.total ?? 0

  const handleRowClick = (task: Task) => {
    router.push(`/tasks/${task.id}`)
  }

  const columns = [
    {
      key: "goal",
      header: "Goal",
      render: (task: Task) => (
        <div className="max-w-md">
          <div className="font-medium truncate">{task.goal}</div>
        </div>
      ),
    },
    {
      key: "user",
      header: "User",
      render: (task: Task) => (
        <div>
          {task.user ? (
            <>
              <div className="font-medium">{task.user.name || "Unknown"}</div>
              <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                {task.user.email}
              </div>
            </>
          ) : (
            <span className="text-muted-foreground text-sm">No user</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (task: Task) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={getStatusColor(task.status) as any}>
            {task.status}
          </Badge>
          {task.isReplay && (
            <Badge variant="outline" className="text-xs">
              Replay
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "device",
      header: "Device",
      render: (task: Task) => (
        <div>
          <div className="font-medium">{task.device.name}</div>
          <div className="text-sm text-muted-foreground">{task.device.deviceId}</div>
        </div>
      ),
    },
    {
      key: "steps",
      header: "Steps",
      render: (task: Task) => task._count.taskSteps,
    },
    {
      key: "createdAt",
      header: "Created",
      render: (task: Task) => format(new Date(task.createdAt), "MMM d, yyyy HH:mm"),
    },
    {
      key: "completedAt",
      header: "Completed",
      render: (task: Task) =>
        task.completedAt ? format(new Date(task.completedAt), "MMM d, yyyy HH:mm") : "-",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tasks</h1>
        <p className="text-muted-foreground">View and manage device automation tasks</p>
      </div>

      <DataTable
        data={tasks}
        columns={columns.map(col => ({
          ...col,
          render: col.render ? (item: Task) => (
            <div
              onClick={() => handleRowClick(item)}
              className="cursor-pointer"
            >
              {col.render!(item)}
            </div>
          ) : undefined
        }))}
        searchable
        searchPlaceholder="Search tasks..."
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        filterable
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "", label: "All Statuses" },
              { value: "RUNNING", label: "Running" },
              { value: "COMPLETED", label: "Completed" },
              { value: "FAILED", label: "Failed" },
              { value: "TIMED_OUT", label: "Timed Out" },
            ],
          },
        ]}
        onFilterChange={(filters) => {
          setStatusFilter(filters.status || "")
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
