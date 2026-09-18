import { NextRequest, NextResponse } from "next/server";
import { storage } from "@droiduse/shared-lib/server";
import { auth } from "@/lib/auth";

/**
 * Consolidated dashboard endpoint
 * Fetches all dashboard data in a single request
 * Reduces network calls from 3 → 1
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate once for all requests
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch all data in parallel
    const [skills, devices, tasks] = await Promise.all([
      storage.getSkills({ authorId: userId }),
      storage.getDevices(), // Note: Not user-filtered in original implementation
      storage.getTasks({ userId, limit: 50 }), // Limit to recent 50 tasks
    ]);

    return NextResponse.json({
      skills,
      devices,
      tasks,
    });
  } catch (error) {
    console.error("[api] Failed to fetch dashboard data:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch dashboard data",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
