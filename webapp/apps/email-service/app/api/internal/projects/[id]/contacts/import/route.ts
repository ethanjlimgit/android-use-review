import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/email-prisma"
import crypto from "crypto"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const columnMappingStr = formData.get("columnMapping") as string | null

    if (!file || !columnMappingStr) {
      return NextResponse.json({ error: "File and column mapping are required" }, { status: 400 })
    }

    const columnMapping = JSON.parse(columnMappingStr)
    const text = await file.text()
    const lines = text.split("\n").filter((line) => line.trim())

    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV file must have at least a header and one data row" }, { status: 400 })
    }

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""))
    const dataRows = lines.slice(1)

    let processed = 0
    const errors: Array<{ row: number; error: string }> = []

    for (let i = 0; i < dataRows.length; i++) {
      const cols = dataRows[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
      const record: Record<string, string> = {}

      for (const [csvCol, contactField] of Object.entries(columnMapping)) {
        const idx = headers.indexOf(csvCol)
        if (idx >= 0 && cols[idx]) {
          record[contactField as string] = cols[idx]
        }
      }

      if (!record.email) {
        errors.push({ row: i + 2, error: "Missing email" })
        continue
      }

      try {
        await prisma.contact.upsert({
          where: {
            projectId_email: { projectId, email: record.email },
          },
          create: {
            projectId,
            email: record.email,
            firstName: record.firstName ?? null,
            lastName: record.lastName ?? null,
            phone: record.phone ?? null,
            company: record.company ?? null,
            jobTitle: record.jobTitle ?? null,
            timezone: record.timezone ?? null,
            country: record.country ?? null,
            city: record.city ?? null,
            externalId: record.externalId ?? null,
            source: record.source ?? "csv",
            unsubscribeToken: crypto.randomUUID(),
          },
          update: {
            ...(record.firstName && { firstName: record.firstName }),
            ...(record.lastName && { lastName: record.lastName }),
            ...(record.phone && { phone: record.phone }),
            ...(record.company && { company: record.company }),
            ...(record.jobTitle && { jobTitle: record.jobTitle }),
            ...(record.timezone && { timezone: record.timezone }),
            ...(record.country && { country: record.country }),
            ...(record.city && { city: record.city }),
          },
        })
        processed++
      } catch (err) {
        errors.push({ row: i + 2, error: String(err) })
      }
    }

    return NextResponse.json({
      success: true,
      totalRows: dataRows.length,
      processed,
      errors: errors.length > 0 ? errors.slice(0, 20) : [],
    })
  } catch (error) {
    console.error("Error importing contacts:", error)
    return NextResponse.json({ error: "Failed to import contacts" }, { status: 500 })
  }
}
