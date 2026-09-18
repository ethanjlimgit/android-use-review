import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "./email-prisma"

export type ApiKeyContext = {
  project: { id: string; slug: string; name: string; enabled: boolean }
  apiKey: { id: string; scopes: string[] }
}

/**
 * Authenticate an API request via X-API-Key header.
 * Returns the resolved project and API key, or a 401 response.
 */
export async function authenticateApiKey(
  request: NextRequest
): Promise<ApiKeyContext | NextResponse> {
  const apiKey = request.headers.get("x-api-key")

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing X-API-Key header" },
      { status: 401 }
    )
  }

  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex")

  const record = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: {
      project: {
        select: { id: true, slug: true, name: true, enabled: true },
      },
    },
  })

  if (!record) {
    return NextResponse.json(
      { error: "Invalid API key" },
      { status: 401 }
    )
  }

  if (!record.enabled) {
    return NextResponse.json(
      { error: "API key is disabled" },
      { status: 401 }
    )
  }

  if (record.expiresAt && record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "API key has expired" },
      { status: 401 }
    )
  }

  if (!record.project.enabled) {
    return NextResponse.json(
      { error: "Project is disabled" },
      { status: 403 }
    )
  }

  // Update last used timestamp (fire and forget)
  prisma.apiKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {})

  return {
    project: record.project,
    apiKey: { id: record.id, scopes: record.scopes },
  }
}

/**
 * Check if the API key has the required scope.
 */
export function hasScope(ctx: ApiKeyContext, scope: string): boolean {
  return ctx.apiKey.scopes.includes("*") || ctx.apiKey.scopes.includes(scope)
}
