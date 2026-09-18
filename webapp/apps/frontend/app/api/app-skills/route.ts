import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@droiduse/shared-lib/server'
import { handleApiError } from '@/lib/api-helpers'
import { z } from 'zod'

const requestSchema = z.object({
  package_name: z.string().min(1, 'package_name is required'),
  instruction: z.string().optional().default(''),
})

/**
 * POST /api/app-skills
 *
 * Returns formatted app skill content for a specific package
 * App skills have one-to-one mapping with skill entries
 *
 * - If instruction is provided: Uses RAG (vector search + keyword matching) to find best matches
 * - If no instruction: Returns all skill entries for the package
 *
 * Request Body:
 * {
 *   "package_name": "com.google.android.gm",
 *   "instruction": "optional user instruction for RAG search"
 * }
 *
 * Returns:
 * {
 *   "app_skills": "# App Name\n\n## Feature Title\nDescription..."
 * }
 * or 404 if not found
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = requestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { package_name, instruction } = validation.data

    // First, find the app to get its ID
    const app = await storage.prisma.app.findFirst({
      where: { packagePath: package_name },
    })

    if (!app) {
      return NextResponse.json(
        { error: 'App skills not found' },
        { status: 404 }
      )
    }

    let appSkills

    // If instruction is provided, use RAG to find best matches
    if (instruction && instruction.trim().length > 0) {
      // Use hybrid search (vector embeddings + keyword matching) with appId filter
      const searchResults = await storage.searchSkillsWithEmbeddings(
        instruction,
        {
          appId: app.id, // Filter to only this app's skill entries
        }
      )

      // Limit to top 5 most relevant results
      appSkills = searchResults.slice(0, 5)
    } else {
      // No instruction: return all skill entries for this package
      appSkills = await storage.getAppSkillByPackage(package_name)
    }

    if (appSkills.length === 0) {
      return NextResponse.json(
        { error: 'App skills not found' },
        { status: 404 }
      )
    }

    // Format skill entries as markdown
    const formattedSkills = formatAppSkills(app.name, appSkills, instruction)

    return NextResponse.json({ app_skills: formattedSkills })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Format app skill entries into markdown
 * Each skill entry is a separate section
 * When instruction is provided, entries are sorted by relevance from RAG
 */
function formatAppSkills(appName: string, skillEntries: any[], instruction?: string): string {
  const lines = [`# ${appName} App Guide\n`]

  // Add context about RAG search if instruction was provided
  if (instruction && instruction.trim().length > 0) {
    lines.push(`Showing top matches for: "${instruction}"\n`)
  }

  for (const entry of skillEntries) {
    // Add title as heading
    lines.push(`## ${entry.title}\n`)
    // Add description as content
    lines.push(`${entry.description}\n`)
  }

  return lines.join('\n')
}
