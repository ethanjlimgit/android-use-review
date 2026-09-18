import { NextRequest, NextResponse } from "next/server"
import { storage } from "@droiduse/shared-lib/server"
import { ApiError, handleApiError, requireAuth, validateBody } from "@/lib/api-helpers"
import { z } from "zod"

/**
 * FCM Token Registration API
 *
 * Endpoint: POST /api/devices/fcm-token
 *
 * Allows authenticated devices to register or update their FCM token.
 * This endpoint should be called when the Android app receives a new
 * FCM token in the onNewToken() callback.
 */

// Request body schema
const fcmTokenSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
  fcmToken: z.string().min(1, "FCM token is required"),
})

/**
 * POST /api/devices/fcm-token
 * Register or update a device's FCM token
 *
 * Request Headers:
 * - Content-Type: application/json
 * - Authorization: Bearer <access_token>
 *
 * Request Body:
 * {
 *   "deviceId": "unique-device-identifier",
 *   "fcmToken": "fcm-registration-token-string"
 * }
 *
 * Response:
 * 200 OK - Token updated successfully
 * {
 *   "success": true,
 *   "message": "FCM token registered successfully",
 *   "device": { ... }
 * }
 *
 * 400 Bad Request - Invalid request body
 * {
 *   "error": "Invalid data",
 *   "details": [ ... ]
 * }
 *
 * 401 Unauthorized - Missing or invalid authentication
 * {
 *   "error": "Unauthorized"
 * }
 *
 * 403 Forbidden - User doesn't own this device
 * {
 *   "error": "You don't have permission to update this device"
 * }
 *
 * 404 Not Found - Device not found
 * {
 *   "error": "Device not found"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await requireAuth(request);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const validatedData = await validateBody(request, fcmTokenSchema)

    // Get the device
    const device = await storage.getDeviceByDeviceId(validatedData.deviceId)

    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      )
    }

    // Check if user owns this device
    if (device.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You don't have permission to update this device" },
        { status: 403 }
      )
    }

    // Update the FCM token (use device.id, not deviceId)
    const updatedDevice = await storage.updateDevice(device.id, {
      fcmToken: validatedData.fcmToken,
      lastActive: new Date(), // Update last active time
    })

    if (!updatedDevice) {
      return NextResponse.json(
        { error: "Failed to update FCM token" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "FCM token registered successfully",
      device: updatedDevice,
    })

  } catch (error) {
    if (error instanceof ApiError) {
      return handleApiError(error)
    }

    console.error('Error registering FCM token:', error)
    return NextResponse.json(
      { error: "Failed to register FCM token" },
      { status: 500 }
    )
  }
}
