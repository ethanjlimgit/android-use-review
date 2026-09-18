import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, type ApiKeyContext } from "@/lib/api-key-auth"
import { prisma } from "@/lib/email-prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  const { jobId } = await params

  try {
    const job = await prisma.contactImportJob.findUnique({
      where: { id: jobId, projectId: ctx.project.id },
    })

    if (!job) {
      return NextResponse.json({ error: "Import job not found" }, { status: 404 })
    }

    return NextResponse.json(job)
  } catch (error) {
    console.error("Error fetching import job:", error)
    return NextResponse.json({ error: "Failed to fetch import job" }, { status: 500 })
  }
}
