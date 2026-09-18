package com.androiduse.autopilot.service

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.androiduse.autopilot.events.EventHub
import com.androiduse.autopilot.events.model.AndroidUseEvent
import com.androiduse.autopilot.events.model.EventType
import org.json.JSONObject

class AndroidUseNotificationListener : NotificationListenerService() {

    companion object {
        private const val TAG = "AndroidUseNotifListener"
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.i(TAG, "Notification Listener Connected")
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return

        try {
            // 1. Extract Data safely
            val extras = sbn.notification.extras
            val title = extras.getString("android.title")?.toString() ?: ""
            val text = extras.getCharSequence("android.text")?.toString() ?: ""
            val packageName = sbn.packageName

            // 2. Create our clean Payload object
            val payload = JSONObject().apply {
                put("package", packageName)
                put("title", title)
                put("text", text)
                put("id", sbn.id)
                put("tag", sbn.tag ?: "")
                put("is_ongoing", sbn.isOngoing)
                put("post_time", sbn.postTime)
                put("key", sbn.key)
            }

            // 3. Wrap it in our Event Model
            val event = AndroidUseEvent(
                type = EventType.NOTIFICATION,
                payload = payload
            )

            // 4. Send to the Hub
            EventHub.emit(event)

            // 5. Auto-reply: forward messaging notifications to NotificationReplyManager
            if (isMessagingNotification(sbn) && packageName != applicationContext.packageName) {
                NotificationReplyManager.getInstance(applicationContext)
                    .onNotificationReceived(sbn)
            }

            Log.v(TAG, "Emitted notification from $packageName")

        } catch (e: Exception) {
            Log.e(TAG, "Error processing notification", e)
        }
    }

    /**
     * Check if a notification is from a messaging app (eligible for auto-reply).
     */
    private fun isMessagingNotification(sbn: StatusBarNotification): Boolean {
        if (sbn.isOngoing) return false
        val category = sbn.notification.category
        return category == Notification.CATEGORY_MESSAGE ||
            category == Notification.CATEGORY_SOCIAL
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
         if (sbn == null) return
         
         try {
            val payload = JSONObject().apply {
                put("package", sbn.packageName)
                put("id", sbn.id)
                put("key", sbn.key)
                put("removed", true)
            }
            
            // For now, we can reuse NOTIFICATION type or create a new one.
            // Let's send it as NOTIFICATION but with 'removed' flag for simplicity 
            // unless we want a specific event type.
            val event = AndroidUseEvent(
                type = EventType.NOTIFICATION,
                payload = payload
            )
            
            EventHub.emit(event)
         } catch (e: Exception) {
             Log.e(TAG, "Error processing notification removal", e)
         }
    }
}
