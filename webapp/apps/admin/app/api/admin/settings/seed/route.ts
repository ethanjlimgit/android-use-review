import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@droiduse/shared-lib/server"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  // Only available in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Data seeding is only available in development mode" },
      { status: 403 }
    )
  }

  const session = await auth()
  
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if data already exists
    const existingUsers = await prisma.user.count()
    if (existingUsers > 1) {
      return NextResponse.json(
        { error: "Database already contains data. Please delete existing data first." },
        { status: 400 }
      )
    }

    // Create sample admin user
    const hashedPassword = await bcrypt.hash("admin123", 10)
    const adminUser = await prisma.user.create({
      data: {
        email: "admin@example.com",
        name: "Admin User",
        password: hashedPassword,
        role: "admin",
        username: "admin",
      },
    })

    // Create sample regular users
    const user1 = await prisma.user.create({
      data: {
        email: "user1@example.com",
        name: "John Doe",
        password: await bcrypt.hash("user123", 10),
        role: "user",
        username: "johndoe",
      },
    })

    const user2 = await prisma.user.create({
      data: {
        email: "user2@example.com",
        name: "Jane Smith",
        password: await bcrypt.hash("user123", 10),
        role: "user",
        username: "janesmith",
      },
    })

    // Create sample apps
    const app1 = await prisma.app.create({
      data: {
        packagePath: "com.example.app1",
        name: "Sample App 1",
        version: "1.0.0",
        category: "Productivity",
        enabled: true,
      },
    })

    const app2 = await prisma.app.create({
      data: {
        packagePath: "com.example.app2",
        name: "Sample App 2",
        version: "2.0.0",
        category: "Entertainment",
        enabled: true,
      },
    })

    // Create sample blog posts
    await prisma.blogPost.create({
      data: {
        title: "Welcome to Droid Use",
        slug: "welcome-to-droid-use",
        excerpt: "Learn about our platform and how to get started",
        content: "# Welcome to Droid Use\n\nThis is a sample blog post.",
        authorId: adminUser.id,
        status: "published",
        featured: true,
        publishedAt: new Date(),
      },
    })

    await prisma.blogPost.create({
      data: {
        title: "Getting Started Guide",
        slug: "getting-started-guide",
        excerpt: "A comprehensive guide to getting started",
        content: "# Getting Started\n\nThis is a getting started guide.",
        authorId: adminUser.id,
        status: "published",
        featured: false,
        publishedAt: new Date(),
      },
    })

    // Create sample skill entries
    await prisma.skill.create({
      data: {
        title: "How to Use App 1",
        description: "A guide on how to use Sample App 1",
        appId: app1.id,
        score: 10,
        downloads: 5,
        featured: true,
      },
    })

    await prisma.skill.create({
      data: {
        title: "App 2 Tips and Tricks",
        description: "Tips and tricks for Sample App 2",
        appId: app2.id,
        score: 8,
        downloads: 3,
        featured: false,
      },
    })

    // Create popular Android device types
    const samsungS24 = await prisma.deviceType.create({
      data: {
        name: "Samsung Galaxy S24 Ultra",
        osType: "ANDROID",
        manufacturer: "Samsung",
        model: "Galaxy S24 Ultra",
        apiLevel: 34,
        widthPixels: 1440,
        heightPixels: 3120,
        screenRefreshRate: 120,
        densityDpi: 501,
        density: 3.5,
      },
    })

    const pixel8 = await prisma.deviceType.create({
      data: {
        name: "Google Pixel 8 Pro",
        osType: "ANDROID",
        manufacturer: "Google",
        model: "Pixel 8 Pro",
        apiLevel: 34,
        widthPixels: 1344,
        heightPixels: 2992,
        screenRefreshRate: 120,
        densityDpi: 489,
        density: 3.4,
      },
    })

    const onePlus12 = await prisma.deviceType.create({
      data: {
        name: "OnePlus 12",
        osType: "ANDROID",
        manufacturer: "OnePlus",
        model: "OnePlus 12",
        apiLevel: 34,
        widthPixels: 1440,
        heightPixels: 3168,
        screenRefreshRate: 120,
        densityDpi: 510,
        density: 3.55,
      },
    })

    const xiaomi14 = await prisma.deviceType.create({
      data: {
        name: "Xiaomi 14 Pro",
        osType: "ANDROID",
        manufacturer: "Xiaomi",
        model: "14 Pro",
        apiLevel: 34,
        widthPixels: 1440,
        heightPixels: 3200,
        screenRefreshRate: 120,
        densityDpi: 522,
        density: 3.63,
      },
    })

    // Create devices for the current admin user
    const device1 = await prisma.device.create({
      data: {
        userId: session.user.id,
        name: "My Samsung Galaxy S24",
        deviceId: `device-${session.user.id}-s24-${Date.now()}`,
        deviceTypeId: samsungS24.id,
        osVersion: "Android 14",
        status: "online",
        lastActive: new Date(),
      },
    })

    const device2 = await prisma.device.create({
      data: {
        userId: session.user.id,
        name: "My Pixel 8 Pro",
        deviceId: `device-${session.user.id}-pixel8-${Date.now()}`,
        deviceTypeId: pixel8.id,
        osVersion: "Android 14",
        status: "offline",
        lastActive: new Date(Date.now() - 3600000), // 1 hour ago
      },
    })

    // Create tasks for the devices
    const task1 = await prisma.task.create({
      data: {
        goal: "Open the Settings app and check battery usage",
        userId: session.user.id,
        deviceId: device1.id,
        runType: "developer",
        isReasoning: true,
        status: "COMPLETED",
        totalSteps: 3,
        completedAt: new Date(Date.now() - 1500000), // 25 minutes ago
      },
    })

    const task2 = await prisma.task.create({
      data: {
        goal: "Take a screenshot and share it via WhatsApp",
        userId: session.user.id,
        deviceId: device1.id,
        runType: "developer",
        isReasoning: true,
        status: "RUNNING",
        totalSteps: 0,
      },
    })

    const task3 = await prisma.task.create({
      data: {
        goal: "Navigate to the home screen and open Chrome browser",
        userId: session.user.id,
        deviceId: device2.id,
        runType: "production",
        isReasoning: false,
        status: "RUNNING",
        totalSteps: 0,
      },
    })

    // Create task steps for task1 (completed task)
    await prisma.taskStep.create({
      data: {
        taskId: task1.id,
        stepNumber: 1,
        agentType: "executor",
        actions: [{ type: "click", x: 540, y: 1800 }],
        thought: "I need to find the Settings app icon on the home screen. Looking at the accessibility tree, I can see there's a Settings icon in the app drawer.",
        description: "Opening the app drawer to find Settings",
        subgoal: "Access app drawer",
        confidence: 0.95,
        status: "SUCCESS",
        summary: "Successfully opened app drawer",
        a11yTree: {
          nodes: [
            { text: "App Drawer", role: "button", bounds: { left: 0, top: 0, right: 1080, bottom: 2400 } },
            { text: "Settings", role: "button", bounds: { left: 100, top: 200, right: 300, bottom: 400 } },
          ],
        },
        startedAt: new Date(Date.now() - 1800000),
        completedAt: new Date(Date.now() - 1750000),
      },
    })

    await prisma.taskStep.create({
      data: {
        taskId: task1.id,
        stepNumber: 2,
        agentType: "executor",
        actions: [{ type: "click", x: 200, y: 300 }],
        thought: "I can see the Settings icon in the app drawer. I'll click on it to open the Settings app.",
        description: "Clicking on Settings app icon",
        subgoal: "Open Settings app",
        confidence: 0.98,
        status: "SUCCESS",
        summary: "Settings app opened successfully",
        a11yTree: {
          nodes: [
            { text: "Settings", role: "button", bounds: { left: 100, top: 200, right: 300, bottom: 400 } },
            { text: "Battery", role: "button", bounds: { left: 50, top: 500, right: 1030, bottom: 600 } },
          ],
        },
        startedAt: new Date(Date.now() - 1750000),
        completedAt: new Date(Date.now() - 1700000),
      },
    })

    await prisma.taskStep.create({
      data: {
        taskId: task1.id,
        stepNumber: 3,
        agentType: "executor",
        actions: [{ type: "click", x: 540, y: 550 }],
        thought: "Now I'm in the Settings app. I can see the Battery option in the list. I'll click on it to view battery usage.",
        description: "Clicking on Battery option in Settings",
        subgoal: "View battery usage",
        confidence: 0.97,
        status: "SUCCESS",
        summary: "Battery usage page displayed",
        a11yTree: {
          nodes: [
            { text: "Battery", role: "heading", bounds: { left: 50, top: 100, right: 1030, bottom: 200 } },
            { text: "Battery usage: 45%", role: "text", bounds: { left: 50, top: 250, right: 1030, bottom: 350 } },
          ],
        },
        startedAt: new Date(Date.now() - 1700000),
        completedAt: new Date(Date.now() - 1650000),
      },
    })

    // Create task steps for task2 (running task)
    await prisma.taskStep.create({
      data: {
        taskId: task2.id,
        stepNumber: 1,
        agentType: "executor",
        actions: [{ type: "swipe", fromX: 540, fromY: 2000, toX: 540, toY: 1000, duration: 300 }],
        thought: "I need to take a screenshot first. On Android, I can use the power + volume down button combination, but since I'm controlling via accessibility, I'll use a swipe gesture to reveal the notification panel where screenshot option might be available.",
        description: "Swiping down to open notification panel",
        subgoal: "Access screenshot functionality",
        confidence: 0.85,
        status: "SUCCESS",
        summary: "Notification panel opened",
        a11yTree: {
          nodes: [
            { text: "Screenshot", role: "button", bounds: { left: 50, top: 100, right: 250, bottom: 300 } },
            { text: "Share", role: "button", bounds: { left: 300, top: 100, right: 500, bottom: 300 } },
          ],
        },
        startedAt: new Date(Date.now() - 600000),
        completedAt: new Date(Date.now() - 595000),
      },
    })

    await prisma.taskStep.create({
      data: {
        taskId: task2.id,
        stepNumber: 2,
        agentType: "executor",
        actions: [{ type: "click", x: 150, y: 200 }],
        thought: "I can see the Screenshot button in the notification panel. I'll click on it to take a screenshot.",
        description: "Clicking screenshot button",
        subgoal: "Take screenshot",
        confidence: 0.92,
        status: "SUCCESS",
        summary: "Screenshot taken successfully",
        startedAt: new Date(Date.now() - 595000),
        completedAt: new Date(Date.now() - 590000),
      },
    })

    // Create task steps for task3 (pending task - no steps yet)
    // Task3 is pending, so no steps created yet

    return NextResponse.json({
      message: "Database seeded successfully",
      data: {
        users: 3,
        apps: 2,
        blogPosts: 2,
        skills: 2,
        deviceTypes: 4,
        devices: 2,
        tasks: 3,
        taskSteps: 5,
      },
    })
  } catch (error) {
    console.error("Error seeding database:", error)
    return NextResponse.json(
      { error: "Failed to seed database", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

