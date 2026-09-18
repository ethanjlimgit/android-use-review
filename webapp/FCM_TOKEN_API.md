# FCM Token Registration API

## Overview

This API endpoint allows Android devices to register or update their Firebase Cloud Messaging (FCM) tokens. The FCM token is required for the server to send push notifications to devices for task execution.

## Endpoint

```
POST /api/devices/fcm-token
```

## Authentication

**Required:** Yes

**Method:** Bearer token in Authorization header

```
Authorization: Bearer <access_token>
```

The access token should be obtained through the device authentication flow (email/password or OAuth).

## Request

### Headers

```http
Content-Type: application/json
Authorization: Bearer <access_token>
```

### Body (JSON)

```json
{
  "deviceId": "unique-device-identifier",
  "fcmToken": "fcm-registration-token-string"
}
```

#### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deviceId` | string | Yes | The unique identifier for the device (stored in Device.deviceId, typically Android ID) |
| `fcmToken` | string | Yes | The FCM registration token received from Firebase in `onNewToken()` callback |

## Response

### Success Response

**Code:** `200 OK`

**Content:**

```json
{
  "success": true,
  "message": "FCM token registered successfully",
  "device": {
    "id": "uuid-v4",
    "userId": "user-uuid",
    "name": "Device Name",
    "deviceId": "android-device-id",
    "deviceTypeId": "device-type-uuid",
    "osVersion": "14",
    "status": "online",
    "lastActive": "2026-01-01T12:00:00.000Z",
    "fcmToken": "updated-fcm-token",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

### Error Responses

#### 400 Bad Request

Invalid request body or validation error.

```json
{
  "error": "Invalid data",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "string",
      "inclusive": true,
      "exact": false,
      "message": "FCM token is required",
      "path": ["fcmToken"]
    }
  ]
}
```

#### 401 Unauthorized

Missing or invalid authentication token.

```json
{
  "error": "Unauthorized"
}
```

#### 403 Forbidden

User doesn't own the specified device.

```json
{
  "error": "You don't have permission to update this device"
}
```

#### 404 Not Found

Device with the specified deviceId not found.

```json
{
  "error": "Device not found"
}
```

#### 500 Internal Server Error

Server-side error during token update.

```json
{
  "error": "Failed to register FCM token"
}
```

## Android Integration Example

### Kotlin Implementation

```kotlin
package com.androiduse.service

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class AndroidUseFCMService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "AndroidUseFCMService"
        private const val SERVER_URL = "https://your-server.com" // Configure this
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val httpClient = OkHttpClient()

    /**
     * Called when a new FCM token is generated or refreshed
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "New FCM token generated: $token")

        // Register token with backend server
        serviceScope.launch {
            try {
                registerFcmToken(token)
                Log.i(TAG, "FCM token registered with backend")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to register FCM token with backend", e)
            }
        }
    }

    /**
     * Registers the FCM token with the backend server
     */
    private suspend fun registerFcmToken(fcmToken: String) {
        // Get stored authentication token and device ID
        val sharedPrefs = getSharedPreferences("androiduse_prefs", MODE_PRIVATE)
        val authToken = sharedPrefs.getString("auth_token", null)
            ?: throw Exception("No auth token found")
        val deviceId = sharedPrefs.getString("device_id", null)
            ?: throw Exception("No device ID found")

        // Build request body
        val json = JSONObject().apply {
            put("deviceId", deviceId)
            put("fcmToken", fcmToken)
        }

        val requestBody = json.toString()
            .toRequestBody("application/json".toMediaType())

        // Build request
        val request = Request.Builder()
            .url("$SERVER_URL/api/devices/fcm-token")
            .post(requestBody)
            .addHeader("Authorization", "Bearer $authToken")
            .addHeader("Content-Type", "application/json")
            .build()

        // Execute request
        httpClient.newCall(request).execute().use { response ->
            if (response.isSuccessful) {
                val responseBody = response.body?.string()
                Log.i(TAG, "FCM token registered successfully: $responseBody")
            } else {
                throw Exception("Failed to register FCM token: ${response.code} ${response.message}")
            }
        }
    }
}
```

### Usage Flow

1. **Initial Setup:**
   - User authenticates and receives auth token
   - Device ID is stored (typically Android ID)
   - Both are saved to SharedPreferences

2. **FCM Token Generation:**
   - Firebase generates initial token on app install
   - `onNewToken()` is called with the token
   - Token is sent to server via this API endpoint

3. **Token Refresh:**
   - Firebase may refresh tokens periodically
   - `onNewToken()` is called again with new token
   - New token is sent to server (overwrites old token)

4. **Server Side:**
   - Server validates authentication
   - Updates device record with new FCM token
   - Can now send push notifications to this device

## Testing

### Using cURL

```bash
curl -X POST https://your-server.com/api/devices/fcm-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-access-token>" \
  -d '{
    "deviceId": "android-device-12345",
    "fcmToken": "fcm-token-string-from-firebase"
  }'
```

### Using Postman

1. Set method to `POST`
2. Set URL to `https://your-server.com/api/devices/fcm-token`
3. Add headers:
   - `Content-Type: application/json`
   - `Authorization: Bearer <access-token>`
4. Add raw JSON body:
   ```json
   {
     "deviceId": "android-device-12345",
     "fcmToken": "fcm-token-string-from-firebase"
   }
   ```

## Security Considerations

1. **Authentication Required:** The endpoint requires a valid Bearer token
2. **Ownership Validation:** Users can only update FCM tokens for devices they own
3. **Token Privacy:** FCM tokens are stored securely and not exposed in public APIs
4. **HTTPS Required:** Always use HTTPS in production to protect tokens in transit

## Related Documentation

- [FCM Service Implementation](./apps/frontend/lib/fcm.ts)
- [Task Execution via FCM](./apps/frontend/app/api/tasks/[taskId]/execute/route.ts)
- [Task Status Webhook](./apps/frontend/app/api/tasks/[taskId]/status/route.ts)
- [Android FCM Service](../androidrun-app/...) (adjust path as needed)

## Support

For issues or questions, please refer to the main project documentation or contact the development team.
