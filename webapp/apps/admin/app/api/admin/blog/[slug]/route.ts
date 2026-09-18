import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { storage } from "@droiduse/shared-lib/server"
import { z } from "zod"
import { updateBlogPostSchema } from "@droiduse/shared-lib"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth()
  
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { slug } = await params
    const searchParams = request.nextUrl.searchParams
    const includeContent = searchParams.get("includeContent") === "true"

    const post = await storage.getBlogPostBySlug(slug, includeContent)
    
    if (!post) {
      return NextResponse.json(
        { error: "Blog post not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(post)
  } catch (error) {
    console.error("Error fetching blog post:", error)
    return NextResponse.json(
      { error: "Failed to fetch blog post" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth()
  
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { slug } = await params
    const body = await request.json()
    
    // Get the post first to get its ID
    const existingPost = await storage.getBlogPostBySlug(slug)
    if (!existingPost) {
      return NextResponse.json(
        { error: "Blog post not found" },
        { status: 404 }
      )
    }

    const validatedData = updateBlogPostSchema.parse({ ...body, id: existingPost.id })
    const { id, publishedAt, ...restUpdates } = validatedData

    // Convert publishedAt string to Date if provided
    const processedUpdates: Partial<{
      title: string
      slug: string
      excerpt: string | null
      content: string
      authorId: string
      status: 'draft' | 'published' | 'archived'
      featured: boolean
      featuredImage: string | null
      seoTitle: string | null
      seoDescription: string | null
      seoKeywords: string | null
      publishedAt: Date | null
    }> = { ...restUpdates }

    if (publishedAt) {
      processedUpdates.publishedAt = typeof publishedAt === 'string' 
        ? new Date(publishedAt) 
        : publishedAt
    } else if (restUpdates.status === 'published' && existingPost.status !== 'published' && !publishedAt) {
      processedUpdates.publishedAt = new Date()
    }

    const post = await storage.updateBlogPost(id, processedUpdates)
    
    if (!post) {
      return NextResponse.json(
        { error: "Failed to update blog post" },
        { status: 500 }
      )
    }

    return NextResponse.json(post)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error updating blog post:", error)
    return NextResponse.json(
      { error: "Failed to update blog post" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth()
  
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { slug } = await params
    
    const existingPost = await storage.getBlogPostBySlug(slug)
    if (!existingPost) {
      return NextResponse.json(
        { error: "Blog post not found" },
        { status: 404 }
      )
    }

    const deleted = await storage.deleteBlogPost(existingPost.id)
    
    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete blog post" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting blog post:", error)
    return NextResponse.json(
      { error: "Failed to delete blog post" },
      { status: 500 }
    )
  }
}

