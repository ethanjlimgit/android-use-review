import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@droiduse/shared-lib/server"

export async function POST(request: NextRequest) {
  // Only available in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Data deletion is only available in development mode" },
      { status: 403 }
    )
  }

  const session = await auth()
  
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { type } = body

    if (!type || !["all", "users", "blog", "apps", "skills"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be one of: all, users, blog, apps, skills" },
        { status: 400 }
      )
    }

    let deletedCounts: Record<string, number> = {}
    const currentUserId = session.user.id

    if (type === "all") {
      // Delete in order to respect foreign key constraints
      
      // 1. Delete task steps first (depend on tasks)
      const taskStepsCount = await prisma.taskStep.deleteMany({})
      deletedCounts.taskSteps = taskStepsCount.count

      // 2. Delete tasks (depend on devices)
      const tasksCount = await prisma.task.deleteMany({})
      deletedCounts.tasks = tasksCount.count

      // 3. Delete devices (depend on device types and users)
      const devicesCount = await prisma.device.deleteMany({})
      deletedCounts.devices = devicesCount.count

      // 4. Delete device types (independent)
      const deviceTypesCount = await prisma.deviceType.deleteMany({})
      deletedCounts.deviceTypes = deviceTypesCount.count

      // 5. Delete skills (independent)
      const skillsCount = await prisma.skill.deleteMany({})
      deletedCounts.skills = skillsCount.count

      // 6. Delete blog posts (depend on users, but we'll delete all)
      const blogPostsCount = await prisma.blogPost.deleteMany({})
      deletedCounts.blogPosts = blogPostsCount.count

      // 7. Delete apps (independent)
      const appsCount = await prisma.app.deleteMany({})
      deletedCounts.apps = appsCount.count

      // 8. Delete other users' accounts and sessions (keep current user's)
      const accountsCount = await prisma.account.deleteMany({
        where: {
          userId: {
            not: currentUserId,
          },
        },
      })
      deletedCounts.accounts = accountsCount.count

      const sessionsCount = await prisma.session.deleteMany({
        where: {
          userId: {
            not: currentUserId,
          },
        },
      })
      deletedCounts.sessions = sessionsCount.count

      // 9. Delete other users (keep current user)
      const usersCount = await prisma.user.deleteMany({
        where: {
          id: {
            not: currentUserId,
          },
        },
      })
      deletedCounts.users = usersCount.count
    } else {
      // Handle individual type deletions
      if (type === "skills") {
        const count = await prisma.skill.deleteMany({})
        deletedCounts.skills = count.count
      }

      if (type === "blog") {
        const count = await prisma.blogPost.deleteMany({})
        deletedCounts.blogPosts = count.count
      }

      if (type === "apps") {
        const count = await prisma.app.deleteMany({})
        deletedCounts.apps = count.count
      }

      if (type === "users") {
        // Delete other users' accounts and sessions first
        await prisma.account.deleteMany({
          where: {
            userId: {
              not: currentUserId,
            },
          },
        })
        await prisma.session.deleteMany({
          where: {
            userId: {
              not: currentUserId,
            },
          },
        })
        const count = await prisma.user.deleteMany({
          where: {
            id: {
              not: currentUserId,
            },
          },
        })
        deletedCounts.users = count.count
      }
    }

    return NextResponse.json({
      message: `Successfully deleted ${type} data`,
      deleted: deletedCounts,
    })
  } catch (error) {
    console.error("Error deleting data:", error)
    return NextResponse.json(
      { error: "Failed to delete data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

