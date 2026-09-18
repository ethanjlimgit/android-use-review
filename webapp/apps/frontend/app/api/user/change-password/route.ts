import { NextRequest, NextResponse } from "next/server"
import { apiHandler, requireAuth, validateBody, ApiError } from "@/lib/api-helpers"
import { changePasswordSchema } from "@droiduse/shared-lib"
import { prisma, bcrypt } from "@droiduse/shared-lib/server"

/**
 * POST /api/user/change-password
 * Changes or sets the authenticated user's password
 *
 * For users with existing password: requires currentPassword verification
 * For OAuth users without password: allows setting a new password
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request)
  const data = await validateBody(request, changePasswordSchema)

  // Fetch user to check existing password
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, password: true },
  })

  if (!user) {
    throw new ApiError("User not found", 404)
  }

  // If user has existing password, verify currentPassword
  if (user.password) {
    if (!data.currentPassword) {
      throw new ApiError("Current password is required", 400)
    }

    const isValid = await bcrypt.compare(data.currentPassword, user.password)

    if (!isValid) {
      throw new ApiError("Current password is incorrect", 403)
    }
  }

  // Hash new password (salt rounds: 10, matching signup route)
  const hashedPassword = await bcrypt.hash(data.newPassword, 10)

  // Update user password
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashedPassword },
  })

  const message = user.password
    ? "Password changed successfully"
    : "Password set successfully. You can now sign in with email and password."

  return NextResponse.json(
    {
      message,
      hasPassword: true,
    },
    { status: 200 }
  )
})
