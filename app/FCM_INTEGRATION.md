# Firebase Cloud Messaging (FCM) Integration Guide

## Overview

This document describes the Firebase Cloud Messaging (FCM) integration in the AndroidUse app, which enables the server to send push notifications to Android devices to initiate agentic tasks remotely.

## Architecture

The FCM integration consists of the following components:

1. **AndroidUseFCMService** (`app/src/main/java/com/androiduse/service/AndroidUseFCMService.kt`)
   - Handles incoming FCM messages
   - Processes different message types (agentic tasks, config updates, health checks)
   - Manages FCM token registration

2. **Firebase Configuration** (`app/google-services.json`)
   - Contains Firebase project configuration
   - Generated from Firebase Console

3. **Build Configuration**
   - FCM dependencies in `build.gradle.kts` files
   - Google Services plugin for Firebase integration

## Setup Instructions

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Add an Android app to your project:
   - Package name: `com.androiduse`
   - App nickname: AndroidUse (optional)
   - Debug signing certificate SHA-1 (optional, for development)

### 2. Download Configuration File

1. Download the `google-services.json` file from Firebase Console
2. Copy it to `androidrun-app/app/google-services.json`
3. The file is already gitignored, so it won't be committed

**Note:** A template file `google-services.json.example` is provided for reference.

### 3. Build the Project

```bash
cd androidrun-app
./gradlew build
```

The Google Services plugin will automatically process the `google-services.json` file during build.

### 4. Verify FCM Token Generation

When the app runs for the first time, it will generate an FCM token. Check the logs:

```bash
adb logcat | grep AndroidUseFCMService
```

You should see:
```
New FCM token generated: <token>
```

## Message Format

### Agentic Task Message

Send FCM messages with the following data payload structure:

```json
{
  "data": {
    "type": "agentic_task",
    "task_id": "unique-task-identifier",
    "command": "open settings and enable wifi",
    "priority": "high",
    "parameters": "{\"timeout\": 30, \"retry\": true}"
  }
}
```

**Fields:**
- `type` (required): Message type, must be `"agentic_task"`
- `task_id` (required): Unique identifier for the task
- `command` (required): The task command to execute
- `priority` (optional): Task priority - `"high"`, `"normal"`, or `"low"` (default: `"normal"`)
- `parameters` (optional): JSON string with additional task parameters

### Configuration Update Message

```json
{
  "data": {
    "type": "config_update",
    "overlay_visible": "true",
    "socket_port": "8080"
  }
}
```

### Health Check Message

```json
{
  "data": {
    "type": "health_check",
    "request_id": "unique-request-id"
  }
}
```

## Sending FCM Messages from Server

### Using Firebase Admin SDK (Python)

```python
from firebase_admin import messaging
import firebase_admin
from firebase_admin import credentials

# Initialize Firebase Admin SDK
cred = credentials.Certificate("path/to/serviceAccountKey.json")
firebase_admin.initialize_app(cred)

def send_task_notification(device_token: str, task_id: str, command: str, priority: str = "normal"):
    """Send agentic task notification to device"""

    message = messaging.Message(
        data={
            "type": "agentic_task",
            "task_id": task_id,
            "command": command,
            "priority": priority,
        },
        token=device_token,
        android=messaging.AndroidConfig(
            priority='high',
            notification=messaging.AndroidNotification(
                title='New Task',
                body=command,
                channel_id='androiduse_tasks'
            )
        )
    )

    response = messaging.send(message)
    print(f"Successfully sent message: {response}")
    return response

# Example usage
device_token = "device-fcm-token-from-registration"
send_task_notification(
    device_token=device_token,
    task_id="task-123",
    command="open settings and enable wifi",
    priority="high"
)
```

### Using HTTP API

```bash
curl -X POST https://fcm.googleapis.com/v1/projects/YOUR_PROJECT_ID/messages:send \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "token": "DEVICE_FCM_TOKEN",
      "data": {
        "type": "agentic_task",
        "task_id": "task-123",
        "command": "open settings",
        "priority": "high"
      },
      "android": {
        "priority": "high"
      }
    }
  }'
```

## Task Execution Integration Points

### Current Implementation Status

The FCM service is **fully integrated** and ready to receive messages. However, the **task execution logic is not yet implemented**. You need to integrate it with your task execution system.

### Integration Location

The main integration point is in `AndroidUseFCMService.kt` at line 151-201 in the `handleAgenticTask()` method:

```kotlin
/**
 * File: app/src/main/java/com/androiduse/service/AndroidUseFCMService.kt
 * Method: handleAgenticTask()
 * Lines: 151-201
 */
private fun handleAgenticTask(data: Map<String, String>) {
    // ... message parsing code ...

    // *** TODO: INTEGRATE WITH TASK EXECUTION SYSTEM ***
    // See inline documentation for integration options
}
```

### Integration Options

#### Option 1: Direct ActionDispatcher Integration (Recommended for Simple Tasks)

**Location:** `AndroidUseFCMService.kt:151-201`

Directly use the `ActionDispatcher` from `AndroidUseAccessibilityService`:

```kotlin
private fun handleAgenticTask(data: Map<String, String>) {
    val taskId = data[KEY_TASK_ID] ?: return
    val command = data[KEY_COMMAND] ?: return

    serviceScope.launch {
        try {
            val accessibilityService = AndroidUseAccessibilityService.getInstance()
            if (accessibilityService != null) {
                val actionDispatcher = accessibilityService.getActionDispatcher()

                // Create a task queue system or execute directly
                // Example: actionDispatcher.executeCommand(command)

                Log.i(TAG, "Task executed: $taskId")
            } else {
                Log.e(TAG, "Accessibility service not available")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error executing task: $taskId", e)
        }
    }
}
```

**Pros:**
- Direct execution on device
- No network dependency after receiving FCM message
- Fast execution

**Cons:**
- Limited to ActionDispatcher capabilities
- No backend agent orchestration
- Need to implement task queue if handling multiple tasks

#### Option 2: Backend API Integration (Recommended for Complex Agentic Tasks)

**Location:** `AndroidUseFCMService.kt:151-201`

Send task acknowledgment to backend and let the backend agent execute via WebSocket/REST API:

```kotlin
private fun handleAgenticTask(data: Map<String, String>) {
    val taskId = data[KEY_TASK_ID] ?: return
    val command = data[KEY_COMMAND] ?: return

    serviceScope.launch {
        try {
            // Get authenticated API service
            val sessionManager = SessionManager.getInstance(applicationContext)
            val authToken = sessionManager.getAuthToken()

            if (authToken != null) {
                val apiService = RetrofitClient.getAuthApiService()

                // Acknowledge task receipt
                apiService.acknowledgeTask(taskId, "received")

                // Backend will then execute the task via existing WebSocket/REST API
                // The execution happens through the DroidUse backend agent system
                // which provides better orchestration and monitoring

                Log.i(TAG, "Task acknowledged: $taskId")
            } else {
                Log.e(TAG, "User not authenticated, cannot acknowledge task")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error acknowledging task: $taskId", e)
        }
    }
}
```

**Required Backend API Endpoint:**

Add this endpoint to your backend (DroidUse backend):

```python
# droiduse-backend/droiduse_backend/api/routes.py

@router.post("/api/v1/tasks/{task_id}/acknowledge")
async def acknowledge_task(task_id: str, status: str, token: str = Header(...)):
    """
    Acknowledge FCM task receipt and trigger agent execution

    After receiving FCM notification, the Android app calls this endpoint
    to confirm receipt and trigger the backend agent to execute the task.
    """
    # Validate token and get device
    device = await get_device_by_token(token)

    # Get task from database
    task = await db.get_task(task_id)

    # Update task status
    task.status = status
    await db.update_task(task)

    # Trigger agent execution via existing WebSocket/REST infrastructure
    if status == "received":
        # Use the existing DroidAgent system
        agent = DroidAgent(
            llm=get_llm(),
            device_serial=device.serial,
        )

        result = await agent.run(goal=task.command)

        # Update task with result
        task.status = "completed" if result.success else "failed"
        task.result = result.to_dict()
        await db.update_task(task)

    return {"status": "ok", "task_id": task_id}
```

**Pros:**
- Leverages existing backend agent infrastructure
- Better task orchestration and monitoring
- Centralized logging and observability
- Supports complex multi-step tasks

**Cons:**
- Requires network connection
- Slightly higher latency
- Depends on backend availability

#### Option 3: Event-Based Integration

**Location:** `AndroidUseFCMService.kt:151-201`

Publish task events to EventHub for other components to handle:

```kotlin
private fun handleAgenticTask(data: Map<String, String>) {
    val taskId = data[KEY_TASK_ID] ?: return
    val command = data[KEY_COMMAND] ?: return
    val priority = data[KEY_PRIORITY] ?: "normal"
    val parameters = data[KEY_PARAMETERS]

    // Publish event to EventHub
    EventHub.publish(AgenticTaskEvent(
        taskId = taskId,
        command = command,
        priority = priority,
        parameters = parameters
    ))

    Log.i(TAG, "Task event published: $taskId")
}
```

**Required Event Class:**

Create a new event type in `app/src/main/java/com/androiduse/events/model/AndroidUseEvent.kt`:

```kotlin
data class AgenticTaskEvent(
    val taskId: String,
    val command: String,
    val priority: String,
    val parameters: String?
) : AndroidUseEvent(EventType.AGENTIC_TASK)
```

**Pros:**
- Decoupled architecture
- Multiple subscribers can handle the same task
- Easy to add new task handlers

**Cons:**
- Need to implement event subscribers
- More complex architecture
- Need to manage event queue

### Recommended Approach

**For production use: Option 2 (Backend API Integration)**

This approach:
- Keeps the FCM service lightweight and focused on receiving notifications
- Delegates execution to the existing DroidUse backend infrastructure
- Provides better monitoring, logging, and error handling
- Supports complex agentic tasks with multi-agent orchestration

## FCM Token Management

### Token Registration

The FCM token should be registered with your backend when:
1. App is first installed and token is generated
2. Token is refreshed (rare, but can happen)
3. User logs in/authenticates

**Implementation Location:** `AndroidUseFCMService.kt:73-97`

Uncomment and implement the token registration logic:

```kotlin
override fun onNewToken(token: String) {
    super.onNewToken(token)
    Log.d(TAG, "New FCM token generated: $token")

    serviceScope.launch {
        try {
            val sessionManager = SessionManager.getInstance(applicationContext)
            val authToken = sessionManager.getAuthToken()

            if (authToken != null) {
                val apiService = RetrofitClient.getAuthApiService()

                // Register FCM token with backend
                val response = apiService.registerFCMToken(
                    fcmToken = token,
                    authToken = authToken
                )

                if (response.isSuccessful) {
                    Log.i(TAG, "FCM token registered with backend")
                } else {
                    Log.e(TAG, "Failed to register FCM token: ${response.code()}")
                }
            } else {
                Log.w(TAG, "User not authenticated, cannot register FCM token")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register FCM token with backend", e)
        }
    }
}
```

### Backend API Endpoint for Token Registration

Add this endpoint to your backend:

```python
# droiduse-backend/droiduse_backend/api/routes.py

@router.post("/api/v1/devices/fcm-token")
async def register_fcm_token(
    fcm_token: str,
    token: str = Header(...),
    db: Database = Depends(get_db)
):
    """Register or update FCM token for device"""

    # Validate auth token and get user
    user = await authenticate_user(token)

    # Get or create device
    device = await db.get_or_create_device(
        user_id=user.id,
        platform="android"
    )

    # Update FCM token
    device.fcm_token = fcm_token
    device.updated_at = datetime.utcnow()
    await db.update_device(device)

    return {
        "status": "ok",
        "device_id": device.id,
        "fcm_token": fcm_token
    }
```

## Testing

### 1. Test FCM Service Locally

Use Firebase Console to send test messages:

1. Go to Firebase Console > Cloud Messaging
2. Click "Send test message"
3. Add your device's FCM token
4. Send a data message with the agentic task payload

### 2. Test with curl

```bash
# Get FCM token from device logs
adb logcat | grep "FCM token"

# Send test message using Firebase Cloud Messaging API
curl -X POST https://fcm.googleapis.com/v1/projects/YOUR_PROJECT_ID/messages:send \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "token": "DEVICE_FCM_TOKEN",
      "data": {
        "type": "agentic_task",
        "task_id": "test-123",
        "command": "open settings",
        "priority": "high"
      }
    }
  }'
```

### 3. Monitor Logs

```bash
# Monitor FCM service logs
adb logcat -s AndroidUseFCMService

# Monitor all app logs
adb logcat -s AndroidUse*
```

## Security Considerations

1. **Token Security**: FCM tokens should be treated as sensitive data
   - Never log tokens in production
   - Use HTTPS for all token transmission
   - Implement token rotation

2. **Message Validation**: Always validate incoming messages
   - Check message type
   - Validate task_id format
   - Sanitize command strings

3. **Authentication**: Verify user authentication before executing tasks
   - Check if user is logged in
   - Validate auth token with backend
   - Implement rate limiting

4. **Permissions**: Request notification permission on Android 13+
   - Check if permission is granted
   - Request permission if needed
   - Handle permission denial gracefully

## Troubleshooting

### FCM Token Not Generated

**Problem:** No FCM token in logs after app installation

**Solutions:**
1. Verify `google-services.json` is in the correct location
2. Check that Google Play Services is installed on device
3. Ensure device has internet connectivity
4. Check Firebase project configuration

### Messages Not Received

**Problem:** FCM messages sent but not received on device

**Solutions:**
1. Verify FCM token is correct and up-to-date
2. Check app is not in Doze mode (battery optimization)
3. Verify Firebase project sender ID matches
4. Check message payload format is correct
5. Review Firebase Cloud Messaging delivery reports

### Build Errors

**Problem:** Build fails with Google Services plugin errors

**Solutions:**
1. Ensure `google-services.json` exists in `app/` directory
2. Verify file is valid JSON (use JSON validator)
3. Clean and rebuild: `./gradlew clean build`
4. Update Google Services plugin to latest version

## Related Files

- **FCM Service:** `app/src/main/java/com/androiduse/service/AndroidUseFCMService.kt`
- **Manifest:** `app/src/main/AndroidManifest.xml` (lines 72-80)
- **Dependencies:** `gradle/libs.versions.toml` (Firebase section)
- **App Build Config:** `app/build.gradle.kts`
- **Root Build Config:** `build.gradle.kts`
- **Firebase Config Template:** `app/google-services.json.example`
- **Gitignore:** `app/.gitignore`

## Next Steps

1. **Setup Firebase Project** following the instructions above
2. **Implement token registration** in `AndroidUseFCMService.kt:73-97`
3. **Choose and implement task execution integration** (Option 1, 2, or 3)
4. **Add backend API endpoint** for task acknowledgment (if using Option 2)
5. **Test FCM integration** using Firebase Console
6. **Implement notification permission handling** for Android 13+
7. **Add task queue system** if handling multiple concurrent tasks

## Additional Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Admin SDK (Python)](https://firebase.google.com/docs/admin/setup)
- [Android Notification Permissions](https://developer.android.com/develop/ui/views/notifications/notification-permission)
