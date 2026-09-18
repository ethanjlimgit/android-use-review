import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey, type ApiKeyContext } from "@/lib/api-key-auth"
import { prisma } from "@/lib/email-prisma"
import { z } from "zod"
import { createContactSchema } from "@/lib/schemas"
import type { Prisma } from "@/generated/client"
import crypto from "crypto"

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const pageSize = parseInt(searchParams.get("pageSize") || "50")
  const search = searchParams.get("search")
  const listId = searchParams.get("listId")

  try {
    const where: Record<string, unknown> = { projectId: ctx.project.id }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
      ]
    }

    if (listId) {
      where.listMemberships = { some: { listId } }
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.contact.count({ where }),
    ])

    return NextResponse.json({
      contacts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("Error fetching contacts:", error)
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as ApiKeyContext

  try {
    const body = await request.json()
    const data = createContactSchema.parse(body)

    const contact = await prisma.contact.create({
      data: {
        projectId: ctx.project.id,
        email: data.email,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        externalId: data.externalId ?? null,
        phone: data.phone ?? null,
        company: data.company ?? null,
        jobTitle: data.jobTitle ?? null,
        timezone: data.timezone ?? null,
        country: data.country ?? null,
        city: data.city ?? null,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
        source: data.source ?? "api",
        unsubscribeToken: crypto.randomUUID(),
      },
    })

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }
    console.error("Error creating contact:", error)
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 })
  }
}
