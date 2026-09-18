import { NextResponse } from "next/server"
import { prisma } from "@droiduse/shared-lib/server"

/**
 * GET /api/settings
 * Fetch all app settings (public access)
 */
export async function GET() {
  try {
    const settings = await prisma.appSettings.findMany({
      orderBy: [
        { category: 'asc' },
        { key: 'asc' }
      ]
    })

    // Convert to key-value object for easier consumption
    const settingsObject = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, string>)

    return NextResponse.json({
      settings: settingsObject,
      raw: settings // Include raw array for admin purposes
    })
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    )
  }
}
