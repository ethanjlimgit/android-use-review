"use client"

import { useQuery, useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Badge } from "@droiduse/shared-ui/badge"
import { Button } from "@droiduse/shared-ui/button"
import { ScrollArea } from "@droiduse/shared-ui/scroll-area"
import { Skeleton } from "@droiduse/shared-ui/skeleton"
import { useToast } from "@droiduse/shared-ui/use-toast"
import { CheckCircle2, XCircle, Clock, Loader2, AlertCircle, Play } from "lucide-react"
import { apiRequest, queryClient } from "@droiduse/shared-lib"
import TaskStepOverview from "./task-step-overview"
import type { TaskWithSteps } from "@droiduse/shared-lib"

interface TaskDetailPanelProps {
  taskId: string
}

export default function TaskDetailPanel({ taskId }: TaskDetailPanelProps) {
  const { toast } = useToast()

  const { data: task, isLoading } = useQuery<TaskWithSteps>({
    queryKey: [`/api/tasks/${taskId}`],
    refetchInterval: (query) => {
      // Poll every 2 seconds if task is running
      const task = query.state.data as TaskWithSteps | undefined
      return task?.status === 'RUNNING' ? 2000 : false
    },
  })

  const executeTaskMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/tasks/${taskId}/execute`, {})
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}`] })
      toast({
        title: "Task started",
        description: "Your task is now running on the device.",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start task",
        description: error?.message || "An error occurred while starting the task.",
        variant: "destructive",
      })
    },
  })

  const statusConfig = {
    RUNNING: { icon: Loader2, color: "text-primary", bg: "bg-primary/10", label: "Running" },
    COMPLETED: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", label: "Completed" },
    FAILED: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", label: "Failed" },
    TIMED_OUT: { icon: XCircle, color: "text-orange-500", bg: "bg-orange-500/10", label: "Timed Out" },
  }

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col overflow-hidden">
        <CardHeader className="shrink-0">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="flex-1 space-y-4 overflow-auto">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!task) {
    return (
      <Card className="h-full flex items-center justify-center overflow-hidden">
        <CardContent className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm font-medium mb-1">Task not found</p>
          <p className="text-sm text-muted-foreground">
            This task may have been deleted
          </p>
        </CardContent>
      </Card>
    )
  }

  const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.RUNNING
  const StatusIcon = status.icon

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      <Card className="shrink-0">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${status.bg} shrink-0`}>
              <StatusIcon className={`h-5 w-5 ${status.color} ${task.status === 'RUNNING' ? 'animate-spin' : ''}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-lg">Task Details</CardTitle>
                {task.status === 'RUNNING' && (
                  <Button
                    onClick={() => executeTaskMutation.mutate()}
                    disabled={executeTaskMutation.isPending}
                    size="sm"
                    className="gap-2"
                  >
                    <Play className="h-4 w-4" />
                    {executeTaskMutation.isPending ? "Starting..." : "Execute"}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Badge variant="secondary" className="gap-1.5">
                  <StatusIcon className={`h-3 w-3 ${status.color} ${task.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                  {status.label}
                </Badge>
                {task.taskSteps.length > 0 && (
                  <Badge variant="outline">
                    {task.taskSteps.length} / {task.totalSteps || '?'} steps
                  </Badge>
                )}
              </div>
              <div className="rounded-lg border border-border p-4 bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Goal</p>
                <p className="text-sm font-medium">{task.goal}</p>
              </div>
            </div>
          </div>
        </CardHeader>

        {task.status === 'RUNNING' && task.totalSteps > 0 && (
          <CardContent className="pt-0">
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground mb-2">Progress</p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: task.totalSteps > 0
                          ? `${(task.taskSteps.length / task.totalSteps) * 100}%`
                          : '0%'
                      }}
                    />
                  </div>
                </div>
                <p className="text-sm font-medium tabular-nums">
                  {task.taskSteps.length} / {task.totalSteps}
                </p>
              </div>
            </div>
          </CardContent>
        )}

        {task.error && (
          <CardContent className="pt-0">
            <div className="rounded bg-red-500/10 border border-red-500/20 p-4">
              <p className="text-sm font-medium text-red-500 mb-1">Error</p>
              <p className="text-sm text-red-500">{task.error}</p>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="shrink-0">
          <CardTitle className="text-lg">Task Steps</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
          <ScrollArea className="h-full px-6 pb-6">
            {task.taskSteps && task.taskSteps.length > 0 ? (
              <div className="space-y-2">
                {task.taskSteps.map((step) => (
                  <TaskStepOverview key={step.id} step={step} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                  <Clock className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">No steps yet</p>
                <p className="text-sm text-muted-foreground">
                  {task.status === 'RUNNING'
                    ? 'Agent is processing the task...'
                    : 'This task has no recorded steps'}
                </p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
