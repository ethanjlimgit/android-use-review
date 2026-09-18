import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@droiduse/shared-lib/server"
import { completeSurveySchema } from "@droiduse/shared-lib"
import { ApiError, handleApiError, validateBody, requireAuth } from "@/lib/api-helpers"

export async function POST(request: NextRequest) {
  try {
    // Authenticate user (supports both mobile JWT and web session)
    const session = await requireAuth(request)
    const userId = session.user.id

    const validatedData = await validateBody(request, completeSurveySchema)

    // Update user with survey data
    await prisma.user.update({
      where: { id: userId },
      data: {
        surveyCompleted: true,
        surveyCompletedAt: new Date(),
        userType: validatedData.userType,
        companySize: validatedData.companySize || null,
        industry: validatedData.industry,
        occupation: validatedData.occupation,
        useCase: validatedData.useCase,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Survey completed successfully",
    })
  } catch (error: any) {
    console.error("Survey submission error:", error)

    if (error instanceof ApiError && error.status === 400) {
      try {
        const parsed = JSON.parse(error.message) as { details?: Array<{ path?: any[]; message?: string }> }
        const issues = parsed.details ?? []
        const errorMessage = issues.map((e: any) => `${(e.path || []).join('.')}: ${e.message}`).join(', ')
        return NextResponse.json(
          { message: `Invalid survey data: ${errorMessage}`, errors: issues },
          { status: 400 }
        )
      } catch {
        return handleApiError(error)
      }
    } 

    return NextResponse.json(
      { message: "Failed to save survey" },
      { status: 500 }
    )
  }
}
