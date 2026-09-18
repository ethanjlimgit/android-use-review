"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@droiduse/shared-ui/button"
import { Card, CardContent } from "@droiduse/shared-ui/card"
import { ArrowLeft, Smartphone } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import type { Device } from "@droiduse/shared-lib"
import TaskListPanel from "@/components/task-list-panel"
import TaskDetailPanel from "@/components/task-detail-panel"

interface DeviceTasksProps {
  deviceId: string
}

export default function DeviceTasks({ deviceId }: DeviceTasksProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Read taskId from URL query parameter and set it as selected
  useEffect(() => {
    const taskIdFromUrl = searchParams.get('taskId')
    if (taskIdFromUrl) {
      setSelectedTaskId(taskIdFromUrl)
    }
  }, [searchParams])

  // Handler to update both state and URL when task is selected
  const handleTaskSelect = (taskId: string) => {
    setSelectedTaskId(taskId)
    // Update URL without causing a page reload
    const params = new URLSearchParams(searchParams.toString())
    params.set('taskId', taskId)
    router.push(`/devices/${deviceId}/tasks?${params.toString()}`, { scroll: false })
  }

  const { data: device, isLoading: loadingDevice } = useQuery<Device>({
    queryKey: [`/api/devices/${deviceId}`],
  })

  if (loadingDevice) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
          <div className="mx-auto max-w-7xl h-full flex flex-col">
            <div className="h-8 w-48 bg-muted animate-pulse rounded mb-6 shrink-0" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
              <div className="bg-muted animate-pulse rounded" />
              <div className="lg:col-span-2 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!device) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Card>
              <CardContent className="py-16 text-center">
                <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Device not found</h3>
                <p className="text-muted-foreground mb-4">
                  This device may have been removed or doesn't exist
                </p>
                <Button onClick={() => router.push("/devices")}>
                  Back to Devices
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="mx-auto max-w-7xl h-full flex flex-col">
          <div className="flex items-center gap-4 mb-6 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/devices")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {device.name}
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage and execute agent tasks on this device
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
            {/* Left Panel - Task List */}
            <div className="flex flex-col min-h-0">
              <TaskListPanel
                deviceId={deviceId}
                selectedTaskId={selectedTaskId}
                onTaskSelect={handleTaskSelect}
              />
            </div>

            {/* Right Panel - Task Details */}
            <div className="lg:col-span-2 flex flex-col min-h-0">
              {selectedTaskId ? (
                <TaskDetailPanel taskId={selectedTaskId} />
              ) : (
                <Card className="flex-1 flex items-center justify-center">
                  <CardContent className="text-center py-12">
                    <Smartphone className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">
                      Select a task to view details
                    </h3>
                    <p className="text-muted-foreground">
                      Choose a task from the list or create a new one to get started
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
