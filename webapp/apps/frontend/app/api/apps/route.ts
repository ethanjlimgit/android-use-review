import { NextResponse } from "next/server";
import { storage } from "@droiduse/shared-lib/server";

export async function GET() {
  try {
    const apps = await storage.getApps();
    return NextResponse.json(apps);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch apps" },
      { status: 500 }
    );
  }
}

