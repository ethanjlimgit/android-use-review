package com.androiduse.autopilot.cache

import android.app.Notification
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Represents a pending auto-reply to be processed.
 */
data class PendingReply(
    val id: String,
    val packageName: String,
    val senderName: String,
    val messageText: String,
    val timestamp: Long,
    val notificationKey: String,
    val replyAction: Notification.Action?,
    val conversationHistory: List<String>,
    val isKnownConversation: Boolean
)

/**
 * Thread-safe queue for pending auto-reply notifications.
 * Ensures replies are processed sequentially to avoid race conditions.
 */
class NotificationReplyQueue {

    private val queue = ConcurrentLinkedQueue<PendingReply>()

    /** Whether a reply is currently being processed by the manager. */
    val isProcessing = AtomicBoolean(false)

    fun enqueue(reply: PendingReply) {
        queue.add(reply)
    }

    fun dequeue(): PendingReply? = queue.poll()

    fun peek(): PendingReply? = queue.peek()

    fun isEmpty(): Boolean = queue.isEmpty()

    fun size(): Int = queue.size

    fun clear() {
        queue.clear()
    }
}
