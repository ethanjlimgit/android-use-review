import { NextRequest, NextResponse } from "next/server"
import { storage } from "@droiduse/shared-lib/server"
import { auth } from "@/lib/auth"
import { handleApiError, ApiError } from "@/lib/api-helpers"

async function handleLikeToggle(
  skillId: string,
  isLike: boolean
): Promise<NextResponse> {
  const session = await auth()

  if (!session?.user?.id) {
    throw new ApiError("Unauthorized", 401)
  }

  const result = isLike
    ? await storage.likeSkill(skillId, session.user.id)
    : await storage.unlikeSkill(skillId, session.user.id)

  if (!result) {
    throw new ApiError(
      isLike ? "Already liked or skill not found" : "Not liked or skill not found",
      400
    )
  }

  const status = await storage.getSkillLikeStatus(skillId, session.user.id)
  return NextResponse.json(status)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    return await handleLikeToggle(id, true)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    return await handleLikeToggle(id, false)
  } catch (error) {
    return handleApiError(error)
  }
}
