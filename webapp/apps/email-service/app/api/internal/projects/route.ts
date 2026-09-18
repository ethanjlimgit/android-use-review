import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/email-prisma"
import { createProjectSchema } from "@/lib/schemas"
import { z } from "zod"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error("Error fetching projects:", error)
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const data = createProjectSchema.parse(body)

    const existing = await prisma.project.findUnique({
      where: { slug: data.slug },
    })

    if (existing) {
      return NextResponse.json(
        { error: "A project with this slug already exists" },
        { status: 409 }
      )
    }

    const project = await prisma.project.create({
      data: {
        name: data.name,
        slug: data.slug,
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }
    console.error("Error creating project:", error)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}
