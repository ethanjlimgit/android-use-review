import { NextRequest, NextResponse } from "next/server"
import { storage } from "@droiduse/shared-lib/server"
import { updateTaskStepSchema } from "@droiduse/shared-lib"
import { ApiError, handleApiError, validateBody } from "@/lib/api-helpers"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ stepId: string }> }
) {
  try {
    const { stepId } = await params
    const body = await validateBody(request, updateTaskStepSchema)
    // Convert null to undefined for JSON fields (Prisma requirement)
    const validatedData = {
      ...body,
      actions: body.actions === null ? undefined : body.actions,
      a11yTree: body.a11yTree === null ? undefined : body.a11yTree,
      phoneState: body.phoneState === null ? undefined : body.phoneState,
    }
    const step = await storage.updateTaskStep(stepId, validatedData)

    if (!step) {
      return NextResponse.json(
        { error: "Task step not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(step)
  } catch (error) {
    if (error instanceof ApiError) {
      return handleApiError(error)
    }
    console.error('Error updating task step:', error)
    return NextResponse.json(
      { error: "Failed to update task step" },
      { status: 500 }
    )
  }
}
