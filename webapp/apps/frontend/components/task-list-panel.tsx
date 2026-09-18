"use client"

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Button } from "@droiduse/shared-ui/button"
import { Textarea } from "@droiduse/shared-ui/textarea"
import { Badge } from "@droiduse/shared-ui/badge"
import { ScrollArea } from "@droiduse/shared-ui/scroll-area"
import { Checkbox } from "@droiduse/shared-ui/checkbox"
import { Label } from "@droiduse/shared-ui/label"
import { useToast } from "@droiduse/shared-ui/use-toast"
import { apiRequest, queryClient } from "@droiduse/shared-lib"
import { Plus, CheckCircle2, XCircle, Clock, Loader2, Archive } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { Task } from "@droiduse/shared-lib"

interface TaskListPanelProps {
  deviceId: string
  selectedTaskId?: string | null
  onTaskSelect: (taskId: string) => void
}

export default function TaskListPanel({ deviceId, selectedTaskId, onTaskSelect }: TaskListPanelProps) {
  const { toast } = useToast()
  const [goal, setGoal] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [autoExecute, setAutoExecute] = useState(true)

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: [`/api/devices/${deviceId}/tasks`],
    refetchInterval: 30000, // Poll every 30 seconds for updates
  })

  const createTaskMutation = useMutation({
    mutationFn: async (data: { goal: string, autoExecute: boolean }) => {
      const response = await apiRequest("POST", `/api/devices/${deviceId}/tasks`, data)
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/devices/${deviceId}/tasks`] })
      onTaskSelect(data.id)
      setGoal("")
      setIsCreating(false)
      toast({
        title: "Task created",
        description: "Your task has been created successfully.",
      })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create task. Please try again.",
        variant: "destructive",
      })
    },
  })

  const archiveTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiRequest("PATCH", `/api/tasks/${taskId}`, {
        archivedAt: new Date().toISOString(),
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/devices/${deviceId}/tasks`] })
      toast({
        title: "Task archived",
        description: "The task has been archived and removed from your list.",
      })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to archive task. Please try again.",
        variant: "destructive",
      })
    },
  })

  const handleCreateTask = () => {
    if (!goal.trim() || goal.length < 5) {
      toast({
        title: "Invalid goal",
        description: "Task goal must be at least 5 characters.",
        variant: "destructive",
      })
      return
    }
    createTaskMutation.mutate({ goal, autoExecute })
  }

  const statusConfig = {
    PENDING: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted", label: "Pending" },
    RUNNING: { icon: Loader2, color: "text-primary", bg: "bg-primary/10", label: "Running" },
    COMPLETED: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", label: "Completed" },
    FAILED: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", label: "Failed" },
    TIMED_OUT: { icon: XCircle, color: "text-orange-500", bg: "bg-orange-500/10", label: "Timed Out" },
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <Card className="shrink-0">
        <CardHeader>
          <CardTitle className="text-lg">Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {!isCreating ? (
            <Button onClick={() => setIsCreating(true)} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          ) : (
            <div className="space-y-3">
              <Textarea
                placeholder="What do you want the agent to do? (e.g., Open WhatsApp and send a message)"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto-execute"
                  checked={autoExecute}
                  onCheckedChange={(checked) => setAutoExecute(checked === true)}
                />
                <Label
                  htmlFor="auto-execute"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Execute immediately
                </Label>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreateTask}
                  disabled={createTaskMutation.isPending || goal.length < 5}
                  className="flex-1"
                >
                  {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                </Button>
                <Button
                  onClick={() => {
                    setIsCreating(false)
                    setGoal("")
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="shrink-0">
          <CardTitle className="text-lg">Task History</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
          <ScrollArea className="h-full px-6 pb-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-border p-4 animate-pulse">
                    <div className="h-4 w-3/4 bg-muted rounded mb-2" />
                    <div className="h-3 w-1/2 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : tasks && tasks.length > 0 ? (
              <div className="space-y-2">
                {tasks.map((task) => {
                  const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.PENDING
                  const StatusIcon = status.icon

                  return (
                    <div
                      key={task.id}
                      onClick={() => onTaskSelect(task.id)}
                      className={`group rounded-lg border p-4 cursor-pointer transition-all hover:bg-muted/50 ${
                        selectedTaskId === task.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${status.bg} shrink-0 mt-0.5`}>
                          <StatusIcon className={`h-4 w-4 ${status.color} ${task.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-2 mb-1">
                            {task.goal}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              {status.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            archiveTaskMutation.mutate(task.id)
                          }}
                          disabled={archiveTaskMutation.isPending}
                          title="Archive task"
                        >
                          <Archive className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                  <Clock className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">No tasks yet</p>
                <p className="text-sm text-muted-foreground">
                  Create a new task to get started
                </p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
