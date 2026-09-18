import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@droiduse/shared-lib/server"

export async function GET(request: NextRequest) {
  const session = await auth()
  
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get("type") || "all"

    let data: any = {}

    if (type === "all" || type === "users") {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          role: true,
          banned: true,
          bannedAt: true,
          bannedReason: true,
          createdAt: true,
        },
      })
      data.users = users
    }

    if (type === "all" || type === "blog") {
      const blogPosts = await prisma.blogPost.findMany({
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })
      data.blogPosts = blogPosts
    }

    if (type === "all" || type === "apps") {
      const apps = await prisma.app.findMany()
      data.apps = apps
    }

    if (type === "all" || type === "skills") {
      const skills = await prisma.skill.findMany({
        include: {
          app: {
            select: {
              id: true,
              name: true,
              packagePath: true,
            },
          },
        },
      })
      data.skills = skills
    }

    // Return as JSON file
    const json = JSON.stringify(data, null, 2)
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="export-${type}-${new Date().toISOString().split("T")[0]}.json"`,
      },
    })
  } catch (error) {
    console.error("Error exporting data:", error)
    return NextResponse.json(
      { error: "Failed to export data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}



