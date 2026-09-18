import { NextRequest, NextResponse } from "next/server";
import { storage } from "@droiduse/shared-lib/server";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch skill entries for the current user
    const skills = await storage.getSkills({ authorId: session.user.id });
    return NextResponse.json(skills);
  } catch (error) {
    console.error("[api] Failed to fetch user skills:", error);
    return NextResponse.json(
      { error: "Failed to fetch user skills", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
