import { NextRequest, NextResponse } from "next/server";
import { storage } from "@droiduse/shared-lib/server";
import { ApiError, handleApiError, requireAuth, validateBody } from "@/lib/api-helpers";
import { z } from "zod";

const insertUserMemorySchema = z.object({
  type: z.string().min(1, "Type is required"),
  value: z.string().min(1, "Value is required"),
  description: z.string().optional().nullable(),
});

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
    const type = searchParams.get('type') || undefined;

    const memories = await storage.getUserMemories(session.user.id, { type });
    return NextResponse.json(memories);
  } catch (error) {
    console.error("[api] Failed to fetch user memories:", error);
    return NextResponse.json(
      { error: "Failed to fetch user memories" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const validatedData = await validateBody(request, insertUserMemorySchema);

    const memory = await storage.createUserMemory({
      userId: session.user.id,
      ...validatedData,
    });

    return NextResponse.json(memory, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return handleApiError(error)
    }
    console.error("[api] Failed to create user memory:", error);
    return NextResponse.json(
      { error: "Failed to create user memory" },
      { status: 500 }
    );
  }
}



