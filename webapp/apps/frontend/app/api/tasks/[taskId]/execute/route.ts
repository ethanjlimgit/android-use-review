import { NextRequest, NextResponse } from "next/server"
import { storage } from "@droiduse/shared-lib/server"
import { sendTaskNotification } from "@/lib/fcm"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params

    // Get the task
    const task = await storage.getTaskById(taskId)
    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      )
    }

    // Check if task is already running or completed
    if (task.status === 'RUNNING') {
      return NextResponse.json(
        { error: "Task is already running" },
        { status: 400 }
      )
    }

    if (task.status === 'COMPLETED') {
      return NextResponse.json(
        { error: "Task is already completed" },
        { status: 400 }
      )
    }

    // Get the device
    if (!task.deviceId) {
      return NextResponse.json(
        { error: "Task has no associated device" },
        { status: 400 }
      )
    }

    const device = await storage.getDevice(task.deviceId)
    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      )
    }

    // Validate device has FCM token
    if (!device.fcmToken) {
      return NextResponse.json(
        { error: "Device is missing FCM token. Please ensure the device is registered." },
        { status: 400 }
      )
    }

    // Send task execution notification via FCM
    try {
      const messageId = await sendTaskNotification(device.fcmToken, {
        taskId: task.id,
        goal: task.goal,
        isReasoning: task.isReasoning,
      })

      // Update task status to RUNNING
      const updatedTask = await storage.updateTask(taskId, {
        status: 'RUNNING',
      })

      return NextResponse.json({
        success: true,
        task: updatedTask,
        messageId,
      })
    } catch (error) {
      // Update task status to FAILED with error message
      await storage.updateTask(taskId, {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Failed to send FCM notification',
      })

      return NextResponse.json(
        {
          error: "Failed to send task execution notification",
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error executing task:', error)
    return NextResponse.json(
      { error: "Failed to execute task" },
      { status: 500 }
    )
  }
}
