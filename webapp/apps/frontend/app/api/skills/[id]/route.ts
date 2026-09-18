import { NextRequest, NextResponse } from "next/server";
import { storage } from "@droiduse/shared-lib/server";
import { insertSkillSchema } from "@droiduse/shared-lib";
import { verifySkillOwnership, handleApiError, ApiError, validateBody } from "@/lib/api-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const skill = await storage.getSkillById(id);

    if (!skill) {
      throw new ApiError("Skill not found", 404);
    }

    return NextResponse.json(skill);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify authentication and ownership
    await verifySkillOwnership(id);

    // Validate the update data (all fields optional for updates)
    const updateSchema = insertSkillSchema.partial();
    const validatedData = await validateBody(request, updateSchema);

    const skill = await storage.updateSkill(id, validatedData);
    return NextResponse.json(skill);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify authentication and ownership
    await verifySkillOwnership(id);

    await storage.deleteSkill(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
