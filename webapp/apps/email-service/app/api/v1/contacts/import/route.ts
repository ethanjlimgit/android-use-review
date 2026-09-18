import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, type ApiKeyContext } from "@/lib/api-key-auth"
import { prisma } from "@/lib/email-prisma"
import { z } from "zod"
import { importContactsSchema } from "@/lib/schemas"
import type { Prisma } from "@/generated/client"

export async function POST(request: NextRequest) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  try {
    const body = await request.json()
    const data = importContactsSchema.parse(body)

    const job = await prisma.contactImportJob.create({
      data: {
        projectId: ctx.project.id,
        source: "CSV",
        status: "PENDING",
        columnMapping: data.columnMapping as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json(job, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }
    console.error("Error creating import job:", error)
    return NextResponse.json({ error: "Failed to create import job" }, { status: 500 })
  }
}
