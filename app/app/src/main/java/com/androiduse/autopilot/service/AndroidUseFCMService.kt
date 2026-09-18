package com.androiduse.autopilot.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.androiduse.autopilot.ui.MainActivity
import com.androiduse.autopilot.R
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/**
 * Firebase Cloud Messaging Service for AndroidUse
 *
 * This service handles incoming FCM messages from the server to initiate agentic tasks
 * on the Android device.
 *
 * Message Payload Structure:
 * {
 *   "data": {
 *     "type": "agentic_task",
 *     "task_id": "unique-task-identifier",
 *     "command": "The task command to execute",
 *     "priority": "high|normal|low",
 *     "parameters": "{...}" // Optional JSON string with additional parameters
 *   }
 * }
 */
class AndroidUseFCMService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "AndroidUseFCMService"
        private const val CHANNEL_ID = "androiduse_tasks"
        private const val CHANNEL_NAME = "PhoneGPT Tasks"
        private const val NOTIFICATION_ID = 1001

        // Message data keys
        private const val KEY_TYPE = "type"
        private const val KEY_TASK_ID = "task_id"
        private const val KEY_COMMAND = "command"
        private const val KEY_PRIORITY = "priority"
        private const val KEY_PARAMETERS = "parameters"

        // Message types
        private const val TYPE_AGENTIC_TASK = "agentic_task"
        private const val TYPE_CONFIG_UPDATE = "config_update"
        private const val TYPE_HEALTH_CHECK = "health_check"
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        Log.d(TAG, "FCM Service created")
    }

    /**
     * Called when a new FCM token is generated or refreshed
     * This should be sent to your backend server for device registration
     * 
     * The token will only be registered if the user is authenticated.
     * If the user is not authenticated yet, the token will be registered
     * after successful sign-in/sign-up.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "New FCM token generated: $token")

        // Register token with backend if user is authenticated
        FCMTokenManager.registerToken(applicationContext, token)
    }

    /**
     * Called when a message is received from FCM
     */
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        Log.d(TAG, "Message received from: ${remoteMessage.from}")

        // Check if message contains a data payload
        if (remoteMessage.data.isNotEmpty()) {
            Log.d(TAG, "Message data payload: ${remoteMessage.data}")
            handleDataPayload(remoteMessage.data)
        }

        // Check if message contains a notification payload
        remoteMessage.notification?.let { notification ->
            Log.d(TAG, "Message notification body: ${notification.body}")
            showNotification(
                title = notification.title ?: "PhoneGPT",
                message = notification.body ?: "New task received"
            )
        }
    }

    /**
     * Handles the data payload from FCM message
     */
    private fun handleDataPayload(data: Map<String, String>) {
        val messageType = data[KEY_TYPE] ?: run {
            Log.w(TAG, "Message type not specified, ignoring")
            return
        }

        when (messageType) {
            TYPE_AGENTIC_TASK -> handleAgenticTask(data)
            TYPE_CONFIG_UPDATE -> handleConfigUpdate(data)
            TYPE_HEALTH_CHECK -> handleHealthCheck(data)
            else -> Log.w(TAG, "Unknown message type: $messageType")
        }
    }

    /**
     * Handles agentic task messages
     *
     * *** INTEGRATION POINT FOR TASK EXECUTION ***
     *
     * This is where you should integrate with the DroidUse backend agent system.
     * The task execution logic should be implemented here or delegated to the
     * appropriate agent/executor component.
     */
    private fun handleAgenticTask(data: Map<String, String>) {
        val taskId = data[KEY_TASK_ID] ?: run {
            Log.e(TAG, "Task ID missing in agentic task message")
            return
        }

        val command = data[KEY_COMMAND] ?: run {
            Log.e(TAG, "Command missing in agentic task message")
            return
        }

        val priority = data[KEY_PRIORITY] ?: "normal"
        val parameters = data[KEY_PARAMETERS]

        Log.i(TAG, "Agentic task received - ID: $taskId, Command: $command, Priority: $priority")

        // Show notification to user
        showNotification(
            title = "New Task Received",
            message = "Task: $command"
        )

        // *** TODO: INTEGRATE WITH TASK EXECUTION SYSTEM ***
        //
        // Integration options:
        //
        // Option 1: Direct ActionDispatcher integration
        // Get the ActionDispatcher from AndroidUseAccessibilityService and execute the task
        // Example:
        // serviceScope.launch {
        //     try {
        //         val accessibilityService = AndroidUseAccessibilityService.getInstance()
        //         if (accessibilityService != null) {
        //             val actionDispatcher = accessibilityService.getActionDispatcher()
        //             // Execute task via ActionDispatcher
        //             // You may need to create a task queue system to handle multiple tasks
        //         } else {
        //             Log.e(TAG, "Accessibility service not available")
        //         }
        //     } catch (e: Exception) {
        //         Log.e(TAG, "Error executing task", e)
        //     }
        // }
        //
        // Option 2: Backend API integration
        // Send task acknowledgment to backend and let the backend agent execute via WebSocket/REST
        // Example:
        // serviceScope.launch {
        //     try {
        //         val apiService = RetrofitClient.getAuthApiService()
        //         apiService.acknowledgeTask(taskId, "received")
        //         // Backend will then execute the task via existing WebSocket/REST API
        //     } catch (e: Exception) {
        //         Log.e(TAG, "Error acknowledging task", e)
        //     }
        // }
        //
        // Option 3: Event-based integration
        // Publish task event to EventHub for other components to handle
        // Example:
        // EventHub.publish(AgenticTaskEvent(
        //     taskId = taskId,
        //     command = command,
        //     priority = priority,
        //     parameters = parameters
        // ))
        //
        // Recommended approach: Option 2 (Backend API integration)
        // This keeps the FCM service lightweight and delegates execution to the
        // existing backend infrastructure which already has agent capabilities.

        Log.d(TAG, "Task handling logic to be implemented")
    }

    /**
     * Handles configuration update messages
     */
    private fun handleConfigUpdate(data: Map<String, String>) {
        Log.i(TAG, "Configuration update message received")

        // TODO: Implement configuration update logic
        // Example: Update overlay settings, server endpoints, etc.
        // This could integrate with ConfigManager to update app settings remotely
    }

    /**
     * Handles health check messages
     */
    private fun handleHealthCheck(data: Map<String, String>) {
        Log.i(TAG, "Health check message received")

        // TODO: Send health status back to server
        // Example: Report device status, accessibility service status, etc.
        // serviceScope.launch {
        //     val apiService = RetrofitClient.getAuthApiService()
        //     apiService.reportHealthStatus(deviceId, status)
        // }
    }

    /**
     * Creates notification channel for Android O and above
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for AndroidUse task execution"
                enableVibration(true)
                enableLights(true)
            }

            val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    /**
     * Shows a notification to the user
     */
    private fun showNotification(title: String, message: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notificationBuilder.build())
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "FCM Service destroyed")
    }
}
