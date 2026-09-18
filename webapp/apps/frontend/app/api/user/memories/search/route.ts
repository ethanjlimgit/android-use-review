import { NextRequest, NextResponse } from "next/server";
import { storage } from "@droiduse/shared-lib/server";
import { requireAuth } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const type = searchParams.get('type') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const results = await storage.searchUserMemories(
      session.user.id,
      query,
      { type, limit }
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error("[api] Failed to search user memories:", error);
    return NextResponse.json(
      { error: "Failed to search user memories" },
      { status: 500 }
    );
  }
}
