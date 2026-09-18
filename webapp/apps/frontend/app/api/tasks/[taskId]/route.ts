import { NextRequest, NextResponse } from "next/server"
import { storage, prisma, generateEmbedding } from "@droiduse/shared-lib/server"
import { updateTaskSchema } from "@droiduse/shared-lib"
import { requireAuth, apiHandler, validateBody } from "@/lib/api-helpers"
import { incrementCreditUsage } from "@/lib/subscription-helpers"

export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) => {
  // Authenticate request (supports both NextAuth session and mobile JWT)
  const session = await requireAuth(request)
  const { taskId } = await params
  const task = await storage.getTaskById(taskId)

  if (!task) {
    return NextResponse.json(
      { error: "Task not found" },
      { status: 404 }
    )
  }

  // Optional: Verify task ownership
  if (task.userId !== session.user.id && session.user.role !== 'admin') {
    return NextResponse.json(
      { error: "Forbidden - you don't own this task" },
      { status: 403 }
    )
  }

  return NextResponse.json(task)
})

export const PATCH = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) => {
  // Authenticate request (supports both NextAuth session and mobile JWT)
  const session = await requireAuth(request)
  const { taskId } = await params
  const validatedData = await validateBody(request, updateTaskSchema)

  // Get existing task to verify ownership
  const existingTask = await storage.getTaskById(taskId)
  if (!existingTask) {
    return NextResponse.json(
      { error: "Task not found" },
      { status: 404 }
    )
  }

  // Verify task ownership
  if (existingTask.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Forbidden - you don't own this task" },
      { status: 403 }
    )
  }

  const task = await storage.updateTask(taskId, validatedData)

  // Increment credit usage when task completes/fails/times out
  // 1 credit = 1 second of agent work
  if (
    (validatedData.status === 'COMPLETED' || validatedData.status === 'FAILED' || validatedData.status === 'TIMED_OUT') &&
    task?.userId &&
    task?.createdAt &&
    task?.completedAt
  ) {
    const durationMs = new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime()
    const durationSeconds = Math.max(1, Math.ceil(durationMs / 1000)) // Minimum 1 credit

    const creditUpdated = await incrementCreditUsage(task.userId, durationSeconds)
    if (!creditUpdated) {
      console.warn(`Failed to update credit usage for user ${task.userId}, task ${taskId}`)
    }
  }

  // Fire-and-forget: generate embedding + replay actions when task completes successfully
  if (validatedData.status === 'COMPLETED' && task && !task.isReplay) {
    generateTaskEmbedding(taskId).catch(err =>
      console.warn(`[TaskMemory] Failed to generate embedding for ${taskId}:`, err)
    )
  }

  return NextResponse.json(task)
})

export const DELETE = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) => {
  // Authenticate request (supports both NextAuth session and mobile JWT)
  const session = await requireAuth(request)
  const { taskId } = await params

  // Get existing task to verify ownership
  const existingTask = await storage.getTaskById(taskId)
  if (!existingTask) {
    return NextResponse.json(
      { error: "Task not found" },
      { status: 404 }
    )
  }

  // Verify task ownership
  if (existingTask.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Forbidden - you don't own this task" },
      { status: 403 }
    )
  }

  await storage.deleteTask(taskId)
  return new NextResponse(null, { status: 204 })
})

// -- Task Memory helpers --

interface ReplayAction {
  method: string
  params: Record<string, unknown>
  type: "semantic" | "coordinate"
}

function convertStepsToReplayActions(
  taskSteps: Array<{
    status: string
    actions: unknown
    agentType: string
  }>
): ReplayAction[] {
  const replayActions: ReplayAction[] = []

  for (const step of taskSteps) {
    if (step.status !== 'SUCCESS' || !step.actions) continue

    const actions = step.actions as Array<Record<string, unknown>>
    if (!Array.isArray(actions)) continue

    for (const action of actions) {
      const actionType = (action.type as string) || ''
      const mapped = mapActionToReplay(actionType, action)
      if (mapped) replayActions.push(mapped)
    }
  }

  return replayActions
}

function mapActionToReplay(
  actionType: string,
  action: Record<string, unknown>
): ReplayAction | null {
  switch (actionType) {
    case 'tap_element':
    case 'find_and_click':
      return {
        method: 'find_and_click',
        params: {
          by: (action.by as string) || 'text',
          pattern: (action.pattern as string) || (action.element_description as string) || '',
        },
        type: 'semantic',
      }
    case 'type_element':
    case 'find_and_input':
      return {
        method: 'find_and_input',
        params: {
          by: (action.by as string) || 'text',
          pattern: (action.pattern as string) || (action.element_description as string) || '',
          base64_text: (action.base64_text as string) || (action.text as string) || '',
          clear: action.clear !== false,
        },
        type: 'semantic',
      }
    case 'long_press_element':
    case 'find_and_long_press':
      return {
        method: 'find_and_long_press',
        params: {
          by: (action.by as string) || 'text',
          pattern: (action.pattern as string) || (action.element_description as string) || '',
        },
        type: 'semantic',
      }
    case 'click':
    case 'tap':
      return {
        method: 'click',
        params: { x: action.x, y: action.y },
        type: 'coordinate',
      }
    case 'input_text':
      return {
        method: 'keyboard/input',
        params: {
          base64_text: (action.base64_text as string) || (action.text as string) || '',
          clear: action.clear !== false,
        },
        type: 'coordinate',
      }
    case 'swipe':
      return {
        method: 'swipe',
        params: {
          startX: action.startX ?? action.start_x,
          startY: action.startY ?? action.start_y,
          endX: action.endX ?? action.end_x,
          endY: action.endY ?? action.end_y,
          duration: action.duration ?? 300,
        },
        type: 'coordinate',
      }
    case 'open_app':
      return {
        method: 'app/start',
        params: { package: (action.package as string) || (action.package_name as string) || '' },
        type: 'coordinate',
      }
    case 'go_back':
      return {
        method: 'global',
        params: { action: 1 },
        type: 'coordinate',
      }
    default:
      return null
  }
}

async function generateTaskEmbedding(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { taskSteps: { orderBy: { stepNumber: 'asc' } } },
  })
  if (!task || !task.goal || task.taskSteps.length === 0) return

  const replayActions = convertStepsToReplayActions(task.taskSteps)
  if (replayActions.length === 0) return

  const embedding = await generateEmbedding(task.goal)
  const embeddingStr = `[${embedding.join(",")}]`

  await prisma.$queryRawUnsafe(`
    UPDATE "androiduse"."tasks"
    SET embedding = $1::vector, embedding_model = $2
    WHERE id = $3
  `, embeddingStr, 'text-embedding-3-small', taskId)

  console.log(`[TaskMemory] Stored embedding for task ${taskId} (${replayActions.length} replay actions available from steps)`)
}
