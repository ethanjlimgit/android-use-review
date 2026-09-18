package com.androiduse.autopilot.service

import android.app.Notification
import android.app.RemoteInput
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.service.notification.StatusBarNotification
import android.util.Log
import androidx.core.app.NotificationCompat
import com.androiduse.autopilot.cache.NotificationReplyQueue
import com.androiduse.autopilot.cache.PendingReply
import com.androiduse.autopilot.client.BackendWebSocketClient
import com.androiduse.autopilot.config.NotificationReplySettings
import com.androiduse.autopilot.core.SingletonHolder
import kotlinx.coroutines.*
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Central coordinator for the AI auto-reply notification feature.
 *
 * Flow:
 * 1. NotificationListener calls onNotificationReceived()
 * 2. Messaging data is extracted (sender, text, history via MessagingStyle)
 * 3. Settings are checked (shouldAutoReply)
 * 4. If a direct reply action exists, send auto_reply_request via WebSocket
 * 5. On response, use RemoteInput to send the reply inline
 * 6. Fallback: submit as a full agent task via BackendWebSocketService
 * 7. Queue management: if already processing, enqueue; process next on completion
 */
class NotificationReplyManager private constructor(private val context: Context) {

    companion object : SingletonHolder<NotificationReplyManager, Context>(
        { ctx -> NotificationReplyManager(ctx.applicationContext) }
    ) {
        private const val TAG = "NotifReplyManager"
    }

    private val settings = NotificationReplySettings.getInstance(context)
    private val queue = NotificationReplyQueue()
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // Track conversation context per sender for richer LLM prompts
    private val conversationContexts = ConcurrentHashMap<String, MutableList<String>>()

    // Track pending auto-reply request IDs to match responses
    private val pendingRequests = ConcurrentHashMap<String, PendingReply>()

    /**
     * Entry point called from AndroidUseNotificationListener when a messaging notification arrives.
     */
    fun onNotificationReceived(sbn: StatusBarNotification) {
        scope.launch {
            try {
                val packageName = sbn.packageName
                val (senderName, messageText, history) = extractMessagingData(sbn)

                if (senderName.isEmpty() || messageText.isEmpty()) {
                    Log.d(TAG, "Skipping notification: empty sender or text from $packageName")
                    return@launch
                }

                if (!settings.shouldAutoReply(packageName, senderName)) {
                    Log.d(TAG, "Auto-reply disabled for $packageName / $senderName")
                    return@launch
                }

                // Update conversation context
                val contextKey = "$packageName:$senderName"
                val contextHistory = conversationContexts.getOrPut(contextKey) { mutableListOf() }
                contextHistory.add(messageText)
                // Keep last 10 messages
                while (contextHistory.size > 10) contextHistory.removeAt(0)

                val replyAction = findReplyAction(sbn.notification)
                val combinedHistory = if (history.isNotEmpty()) history else contextHistory.toList()

                val pendingReply = PendingReply(
                    id = UUID.randomUUID().toString(),
                    packageName = packageName,
                    senderName = senderName,
                    messageText = messageText,
                    timestamp = System.currentTimeMillis(),
                    notificationKey = sbn.key,
                    replyAction = replyAction,
                    conversationHistory = combinedHistory,
                    isKnownConversation = contextHistory.size > 1
                )

                if (queue.isProcessing.get()) {
                    Log.d(TAG, "Already processing, enqueuing reply for $senderName")
                    queue.enqueue(pendingReply)
                } else {
                    processReply(pendingReply)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error handling notification: ${e.message}", e)
            }
        }
    }

    /**
     * Extract sender name, message text, and conversation history from a StatusBarNotification.
     * Uses MessagingStyle when available for richer data.
     */
    private fun extractMessagingData(sbn: StatusBarNotification): Triple<String, String, List<String>> {
        val notification = sbn.notification
        val extras = notification.extras

        // Try MessagingStyle first for rich conversation data
        val messagingStyle = NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(notification)
        if (messagingStyle != null) {
            val messages = messagingStyle.messages
            if (messages.isNotEmpty()) {
                val lastMessage = messages.last()
                val sender = lastMessage.person?.name?.toString()
                    ?: extras.getString("android.title")
                    ?: ""
                val text = lastMessage.text?.toString() ?: ""
                val history = messages.map { msg ->
                    val who = msg.person?.name?.toString() ?: "Me"
                    "$who: ${msg.text}"
                }
                return Triple(sender, text, history)
            }
        }

        // Fallback to basic extras
        val title = extras.getString("android.title") ?: ""
        val text = extras.getCharSequence("android.text")?.toString() ?: ""
        return Triple(title, text, emptyList())
    }

    /**
     * Find a reply action with RemoteInput in the notification's actions.
     */
    private fun findReplyAction(notification: Notification): Notification.Action? {
        val actions = notification.actions ?: return null
        for (action in actions) {
            val remoteInputs = action.remoteInputs
            if (remoteInputs != null && remoteInputs.isNotEmpty()) {
                return action
            }
        }
        return null
    }

    /**
     * Process a single pending reply. Uses direct reply (WebSocket auto_reply_request)
     * if a reply action is available, otherwise falls back to full agent task.
     */
    private fun processReply(reply: PendingReply) {
        queue.isProcessing.set(true)
        Log.d(TAG, "Processing reply for ${reply.senderName} from ${reply.packageName}")

        if (reply.replyAction != null) {
            // Direct reply path: ask backend for reply text, then use RemoteInput
            submitAutoReplyRequest(reply)
        } else {
            // Agent path: submit as full task
            submitAgentTask(reply)
        }
    }

    /**
     * Send an auto_reply_request to the backend via WebSocket.
     */
    private fun submitAutoReplyRequest(reply: PendingReply) {
        val wsService = BackendWebSocketService.getInstance()
        if (wsService == null) {
            Log.w(TAG, "BackendWebSocketService not available, falling back to agent task")
            submitAgentTask(reply)
            return
        }

        scope.launch {
            try {
                val requestId = wsService.submitAutoReplyRequest(
                    packageName = reply.packageName,
                    senderName = reply.senderName,
                    messageText = reply.messageText,
                    conversationHistory = reply.conversationHistory,
                    customInstructions = settings.customInstructions
                )

                if (requestId != null) {
                    pendingRequests[requestId] = reply
                    Log.d(TAG, "Auto-reply request sent: $requestId")
                } else {
                    Log.w(TAG, "Failed to submit auto-reply request, falling back to agent task")
                    submitAgentTask(reply)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error submitting auto-reply request: ${e.message}", e)
                submitAgentTask(reply)
            }
        }
    }

    /**
     * Fallback: submit as a full agent task via BackendWebSocketService.
     */
    private fun submitAgentTask(reply: PendingReply) {
        val wsService = BackendWebSocketService.getInstance()
        if (wsService == null) {
            Log.w(TAG, "BackendWebSocketService not available, skipping reply")
            onReplyComplete(reply, success = false)
            return
        }

        scope.launch {
            try {
                val command = "Reply to ${reply.senderName} on ${reply.packageName}: " +
                    "Their message: \"${reply.messageText}\""
                val taskId = wsService.submitTask(command)
                if (taskId != null) {
                    Log.d(TAG, "Agent task submitted: $taskId for ${reply.senderName}")
                } else {
                    Log.w(TAG, "Failed to submit agent task")
                    onReplyComplete(reply, success = false)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error submitting agent task: ${e.message}", e)
                onReplyComplete(reply, success = false)
            }
        }
    }

    /**
     * Called when backend returns an auto_reply_response.
     * Sends the reply text via RemoteInput inline action.
     */
    fun onAutoReplyResponse(response: BackendWebSocketClient.AutoReplyResponse) {
        val reply = pendingRequests.remove(response.requestId)
        if (reply == null) {
            Log.w(TAG, "No pending reply for request: ${response.requestId}")
            return
        }

        if (response.success && response.replyText != null) {
            sendDirectReply(reply, response.replyText)
            onReplyComplete(reply, success = true)
        } else {
            Log.w(TAG, "Auto-reply failed: ${response.error}, falling back to agent task")
            submitAgentTask(reply)
        }
    }

    /**
     * Send a reply using the notification's inline reply RemoteInput.
     */
    private fun sendDirectReply(reply: PendingReply, replyText: String) {
        val action = reply.replyAction ?: return
        val remoteInputs = action.remoteInputs ?: return

        try {
            val intent = Intent()
            val bundle = Bundle()
            for (remoteInput in remoteInputs) {
                bundle.putCharSequence(remoteInput.resultKey, replyText)
            }
            RemoteInput.addResultsToIntent(remoteInputs, intent, bundle)
            action.actionIntent.send(context, 0, intent)

            Log.d(TAG, "Direct reply sent to ${reply.senderName}: ${replyText.take(50)}...")
        } catch (e: Exception) {
            Log.e(TAG, "Error sending direct reply: ${e.message}", e)
        }
    }

    /**
     * Called when a reply attempt finishes (success or failure).
     * Records the reply and processes the next item in the queue.
     */
    fun onReplyComplete(reply: PendingReply, success: Boolean) {
        if (success) {
            settings.recordReply(reply.packageName, reply.senderName)
            Log.d(TAG, "Reply recorded for ${reply.senderName}")
        }

        // Process next in queue
        val next = queue.dequeue()
        if (next != null) {
            Log.d(TAG, "Processing next queued reply for ${next.senderName}")
            processReply(next)
        } else {
            queue.isProcessing.set(false)
            Log.d(TAG, "Reply queue empty, processing complete")
        }
    }

    /**
     * Called when a task result arrives (from BackendWebSocketService).
     * If the task was an agent-path auto-reply, mark it complete.
     */
    fun onTaskResult(result: BackendWebSocketClient.TaskResult) {
        // For agent-path replies, the queue is already processing;
        // mark processing done so next queued item can proceed
        if (queue.isProcessing.get()) {
            val next = queue.dequeue()
            if (next != null) {
                processReply(next)
            } else {
                queue.isProcessing.set(false)
            }
        }
    }
}
