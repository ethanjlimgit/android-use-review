import { NextRequest, NextResponse } from "next/server"
import { storage } from "@droiduse/shared-lib/server"
import { insertTaskStepSchema } from "@droiduse/shared-lib"
import { ApiError, handleApiError, validateBody } from "@/lib/api-helpers"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const steps = await storage.getTaskSteps(taskId)
    return NextResponse.json(steps)
  } catch (error) {
    console.error('Error fetching task steps:', error)
    return NextResponse.json(
      { error: "Failed to fetch task steps" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const stepBody = await validateBody(request, insertTaskStepSchema.omit({ taskId: true }))

    // Convert null to undefined for JSON fields (Prisma requirement)
    const validatedData = {
      ...stepBody,
      taskId,
      actions: stepBody.actions === null ? undefined : stepBody.actions,
      a11yTree: stepBody.a11yTree === null ? undefined : stepBody.a11yTree,
      phoneState: stepBody.phoneState === null ? undefined : stepBody.phoneState,
    }

    // Automatically set timestamps based on status
    // Since all task steps have a status (SUCCESS or FAILED), set both timestamps
    const now = new Date()
    if (!validatedData.startedAt) {
      validatedData.startedAt = now
    }
    if (!validatedData.completedAt) {
      validatedData.completedAt = now
    }

    const step = await storage.createTaskStep(validatedData)
    return NextResponse.json(step, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) {
      return handleApiError(error)
    }
    console.error('Error creating task step:', error)
    return NextResponse.json(
      { error: "Failed to create task step" },
      { status: 500 }
    )
  }
}
