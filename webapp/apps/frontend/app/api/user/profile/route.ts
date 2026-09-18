import { NextRequest, NextResponse } from "next/server"
import { apiHandler, requireAuth, validateBody } from "@/lib/api-helpers"
import { updateUserProfileSchema } from "@droiduse/shared-lib"
import { prisma } from "@droiduse/shared-lib/server"

/**
 * GET /api/user/profile
 * Gets the authenticated user's profile
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request)

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      surveyCompleted: true,
    },
  })

  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 })
  }

  return NextResponse.json(user, { status: 200 })
})

/**
 * PATCH /api/user/profile
 * Updates the authenticated user's profile (name field)
 */
export const PATCH = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request)
  const data = await validateBody(request, updateUserProfileSchema)

  // Update user profile
  const updatedUser = await prisma.user.update({
    where: { id: session.user.id },
    data: { name: data.name },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  })

  return NextResponse.json(updatedUser, { status: 200 })
})
