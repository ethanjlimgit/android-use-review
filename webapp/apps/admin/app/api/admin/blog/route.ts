import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { storage } from "@droiduse/shared-lib/server"
import { prisma } from "@droiduse/shared-lib/server"
import { z } from "zod"
import { insertBlogPostSchema } from "@droiduse/shared-lib"

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status")
    const authorId = searchParams.get("authorId")
    const featured = searchParams.get("featured")
    const search = searchParams.get("search")
    const limit = searchParams.get("limit")
    const offset = searchParams.get("offset")

    const where: any = {}

    if (status) where.status = status
    if (authorId) where.authorId = authorId
    if (featured === "true" || featured === "false") {
      where.featured = featured === "true"
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { excerpt: { contains: search, mode: "insensitive" } },
      ]
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        include: { author: true },
        orderBy: { publishedAt: "desc" },
        take: limit ? parseInt(limit) : undefined,
        skip: offset ? parseInt(offset) : undefined,
      }),
      prisma.blogPost.count({ where }),
    ])

    return NextResponse.json({ posts, total })
  } catch (error) {
    console.error("Error fetching blog posts:", error)
    return NextResponse.json(
      { error: "Failed to fetch blog posts" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validatedData = insertBlogPostSchema.parse(body)
    
    // Convert publishedAt string to Date if provided
    const postData = {
      ...validatedData,
      publishedAt: validatedData.publishedAt 
        ? (typeof validatedData.publishedAt === 'string' ? new Date(validatedData.publishedAt) : validatedData.publishedAt)
        : validatedData.status === 'published' 
          ? new Date() 
          : null,
    }

    const post = await storage.createBlogPost(postData)
    return NextResponse.json(post, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error creating blog post:", error)
    return NextResponse.json(
      { error: "Failed to create blog post" },
      { status: 500 }
    )
  }
}

