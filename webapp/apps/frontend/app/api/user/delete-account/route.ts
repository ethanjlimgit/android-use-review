import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@droiduse/shared-lib/server"

/**
 * DELETE /api/user/delete-account
 * Permanently delete user account and all associated data
 */
export async function DELETE() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Delete all user data in a transaction for data integrity
    await prisma.$transaction(async (tx) => {
      // 1. Delete user memories (custom AI memories)
      await tx.userMemory.deleteMany({
        where: { userId },
      })

      // 2. Delete user tokens (email verification, password reset)
      await tx.userToken.deleteMany({
        where: { userId },
      })

      // 3. Delete skill likes
      await tx.skillLike.deleteMany({
        where: { userId },
      })

      // 4. Delete blog posts created by user
      await tx.blogPost.deleteMany({
        where: { authorId: userId },
      })

      // 5. Delete tasks and their steps
      const userTasks = await tx.task.findMany({
        where: { userId },
        select: { id: true },
      })

      for (const task of userTasks) {
        // Delete task steps first
        await tx.taskStep.deleteMany({
          where: { taskId: task.id },
        })
      }

      // Delete tasks
      await tx.task.deleteMany({
        where: { userId },
      })

      // 6. Delete skill entries created by user
      await tx.skill.deleteMany({
        where: { authorId: userId },
      })

      // 7. Delete devices owned by user
      await tx.device.deleteMany({
        where: { userId },
      })

      // 8. Delete OAuth accounts (will cascade automatically due to onDelete: Cascade)
      await tx.account.deleteMany({
        where: { userId },
      })

      // 9. Delete sessions (will cascade automatically due to onDelete: Cascade)
      await tx.session.deleteMany({
        where: { userId },
      })

      // 10. Finally, delete user record
      // Note: Some relations like Account, Session, UserToken have onDelete: Cascade
      // but we delete them explicitly above for clarity and to ensure proper cleanup
      await tx.user.delete({
        where: { id: userId },
      })
    })

    return NextResponse.json(
      {
        success: true,
        message: "Account successfully deleted. All your data has been permanently removed."
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error deleting account:", error)
    return NextResponse.json(
      {
        error: "Failed to delete account",
        message: error instanceof Error ? error.message : "An unexpected error occurred"
      },
      { status: 500 }
    )
  }
}
