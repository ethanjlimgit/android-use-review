import { NextRequest, NextResponse } from "next/server";
import { storage } from "@droiduse/shared-lib/server";
import { ApiError, handleApiError, requireAuth, validateBody } from "@/lib/api-helpers";
import { z } from "zod";

const updateUserMemorySchema = z.object({
  type: z.string().min(1, "Type is required").optional(),
  value: z.string().min(1, "Value is required").optional(),
  description: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const memory = await storage.getUserMemoryById(id);

    if (!memory || memory.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Memory not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(memory);
  } catch (error) {
    console.error("[api] Failed to fetch user memory:", error);
    return NextResponse.json(
      { error: "Failed to fetch user memory" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const validatedData = await validateBody(request, updateUserMemorySchema);

    // Verify ownership
    const existing = await storage.getUserMemoryById(id);
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Memory not found" },
        { status: 404 }
      );
    }

    const memory = await storage.updateUserMemory(id, validatedData);
    return NextResponse.json(memory);
  } catch (error) {
    if (error instanceof ApiError) {
      return handleApiError(error)
    }
    console.error("[api] Failed to update user memory:", error);
    return NextResponse.json(
      { error: "Failed to update user memory" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify ownership
    const existing = await storage.getUserMemoryById(id);
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Memory not found" },
        { status: 404 }
      );
    }

    const deleted = await storage.deleteUserMemory(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Memory not found" },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[api] Failed to delete user memory:", error);
    return NextResponse.json(
      { error: "Failed to delete user memory" },
      { status: 500 }
    );
  }
}
