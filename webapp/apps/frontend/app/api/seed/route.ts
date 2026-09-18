import { NextResponse } from "next/server";
import { storage } from "@droiduse/shared-lib/server";

export async function POST() {
  try {
    await storage.seedData();
    return NextResponse.json({ message: "Database seeded successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to seed database" },
      { status: 500 }
    );
  }
}

