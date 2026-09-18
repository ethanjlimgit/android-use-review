import { prisma } from "@droiduse/shared-lib/server"
import { cache } from "react"

// Default site name
export const DEFAULT_SITE_NAME = "AndroidUse"

/**
 * Get a setting value from the database (server-side only)
 * Uses React cache for request deduplication
 */
export const getSetting = cache(async (key: string): Promise<string | null> => {
  try {
    const setting = await prisma.appSettings.findUnique({
      where: { key }
    })
    return setting?.value ?? null
  } catch (error) {
    console.error(`[settings] Failed to fetch setting "${key}":`, error)
    return null
  }
})

/**
 * Get the site name from settings
 * Returns default if not configured
 */
export const getSiteName = cache(async (): Promise<string> => {
  const siteName = await getSetting("site.name")
  return siteName || DEFAULT_SITE_NAME
})

/**
 * Get multiple settings at once
 */
export const getSettings = cache(async (keys: string[]): Promise<Record<string, string>> => {
  try {
    const settings = await prisma.appSettings.findMany({
      where: {
        key: { in: keys }
      }
    })
    return settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, string>)
  } catch (error) {
    console.error("[settings] Failed to fetch settings:", error)
    return {}
  }
})
