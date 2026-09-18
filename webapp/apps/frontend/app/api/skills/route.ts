import { NextRequest, NextResponse } from "next/server";
import { storage } from "@droiduse/shared-lib/server";
import { insertSkillSchema } from "@droiduse/shared-lib";
import { apiHandler, requireAuth, validateBody } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const { tab, search, scoreMin, scoreMax } = Object.fromEntries(
      searchParams.entries()
    );

    const filters: {
      tab?: string;
      search?: string;
      scoreMin?: number;
      scoreMax?: number;
      authorId?: string;
    } = {};

    if (tab) filters.tab = tab;
    if (search) filters.search = search;
    if (scoreMin) filters.scoreMin = parseInt(scoreMin);
    if (scoreMax) filters.scoreMax = parseInt(scoreMax);

    // Use hybrid search (keyword + vector) when query is provided
    let skills;
    if (search && search.trim().length > 0) {
      skills = await storage.searchSkillsWithEmbeddings(search, filters);
    } else {
      skills = await storage.getSkills(filters);
    }

    return NextResponse.json(skills);
  } catch (error) {
    console.error("[API] Skills search error:", error);
    return NextResponse.json(
      { error: "Failed to fetch skills" },
      { status: 500 }
    );
  }
}

export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request);
  const skillBody = await validateBody(request, insertSkillSchema.omit({ authorId: true }))
  const validatedData = {
    ...skillBody,
    authorId: session.user.id,
  }
  const skill = await storage.createSkill(validatedData);

  return NextResponse.json(skill, { status: 201 });
});
