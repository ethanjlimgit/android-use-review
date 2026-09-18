import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { migrateExistingUserCredits } from "@/lib/subscription-helpers"

/**
 * POST /api/admin/migrate-credits
 * Migrates existing users with 0 credit allowance to free tier credits.
 * Admin only endpoint.
 */
export async function POST() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  if (session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden - admin access required" },
      { status: 403 }
    )
  }

  try {
    const updatedCount = await migrateExistingUserCredits()

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} users with free tier credits`,
      updatedCount,
    })
  } catch (error) {
    console.error("Error migrating user credits:", error)
    return NextResponse.json(
      { error: "Failed to migrate user credits" },
      { status: 500 }
    )
  }
}
