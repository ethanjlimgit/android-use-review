import { NextRequest, NextResponse } from "next/server";
import { storage } from "@droiduse/shared-lib/server";

// Public API - only GET for published blog posts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const featured = searchParams.get("featured");
    const search = searchParams.get("search");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    const filters: {
      status: string;
      featured?: boolean;
      search?: string;
      limit?: number;
      offset?: number;
    } = {
      status: "published", // Always only published posts for public access
    };

    if (featured !== null) filters.featured = featured === "true";
    if (search) filters.search = search;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const posts = await storage.getBlogPosts(filters);
    return NextResponse.json(posts);
  } catch (error) {
    console.error("Error fetching blog posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch blog posts" },
      { status: 500 }
    );
  }
}

