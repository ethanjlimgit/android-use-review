import { NextRequest, NextResponse } from "next/server";
import { storage } from "@droiduse/shared-lib/server";
import { insertDeviceSchema } from "@droiduse/shared-lib";
import { apiHandler, validateBody } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";

export const GET = apiHandler(async () => {
  // Get user session to filter devices by userId
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized - please sign in" },
      { status: 401 }
    );
  }

  // Only show devices belonging to current user
  const devices = await storage.getDevices(userId);
  return NextResponse.json(devices);
});

export const POST = apiHandler(async (request: NextRequest) => {
  const validatedData = await validateBody(request, insertDeviceSchema);
  const device = await storage.createDevice(validatedData);
  return NextResponse.json(device, { status: 201 });
});

