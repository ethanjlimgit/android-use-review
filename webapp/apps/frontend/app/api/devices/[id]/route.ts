import { NextRequest, NextResponse } from "next/server";
import { storage } from "@droiduse/shared-lib/server";
import { auth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - please sign in" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const device = await storage.getDevice(id);

    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    // Verify device ownership
    if (device.userId !== userId && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: "Forbidden - you don't own this device" },
        { status: 403 }
      );
    }

    return NextResponse.json(device);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch device" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - please sign in" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Get existing device to verify ownership
    const existingDevice = await storage.getDevice(id);
    if (!existingDevice) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    // Verify device ownership
    if (existingDevice.userId !== userId && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: "Forbidden - you don't own this device" },
        { status: 403 }
      );
    }

    const device = await storage.updateDevice(id, body);
    return NextResponse.json(device);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update device" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - please sign in" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Get existing device to verify ownership
    const existingDevice = await storage.getDevice(id);
    if (!existingDevice) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    // Verify device ownership
    if (existingDevice.userId !== userId && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: "Forbidden - you don't own this device" },
        { status: 403 }
      );
    }

    await storage.deleteDevice(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete device" },
      { status: 500 }
    );
  }
}

