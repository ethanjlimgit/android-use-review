import { NextRequest, NextResponse } from "next/server"
import { storage } from "@droiduse/shared-lib/server"
import { auth } from "@/lib/auth"
import { insertTaskSchema } from "@droiduse/shared-lib"
import { apiHandler, validateBody } from "@/lib/api-helpers"
import { z } from "zod"

export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status')
  const limit = searchParams.get('limit')

  // Get user session to filter tasks by userId
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized - please sign in" },
      { status: 401 }
    )
  }

  const tasks = await storage.getTasks({
    deviceId: id,
    userId, // Only show tasks belonging to current user
    status: status || undefined,
    limit: limit ? parseInt(limit) : undefined,
  })

  return NextResponse.json(tasks)
});

export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const createTaskBodySchema = insertTaskSchema
    .partial({ deviceId: true, userId: true })
    .extend({ autoExecute: z.boolean().optional() })

  const { autoExecute, ...taskData } = await validateBody(request, createTaskBodySchema)

  // Get user session to include userId and potentially context
  const session = await auth()
  const userId = session?.user?.id || null

  const validatedData = {
    ...taskData,
    deviceId: id,
    userId,
  }

  const task = await storage.createTask(validatedData)

  // Auto-execute the task if requested
  if (autoExecute) {
    try {
      // Import FCM service
      const { sendTaskNotification } = await import('@/lib/fcm')

      // Get device details
      const device = await storage.getDevice(id)

      if (device?.fcmToken) {
        // Send FCM notification to execute the task
        await sendTaskNotification(device.fcmToken, {
          taskId: task.id,
          goal: task.goal,
          isReasoning: task.isReasoning,
        })

        // Update task status to RUNNING
        await storage.updateTask(task.id, {
          status: 'RUNNING',
        })
      }
    } catch (error) {
      console.error('Failed to auto-execute task:', error)
      // Don't fail task creation if auto-execution fails
      // The user can manually execute later
    }
  }

  return NextResponse.json(task, { status: 201 })
});
