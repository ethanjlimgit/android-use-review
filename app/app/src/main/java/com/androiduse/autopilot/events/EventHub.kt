package com.androiduse.autopilot.events

import android.util.Log
import com.androiduse.autopilot.config.ConfigManager
import com.androiduse.autopilot.events.model.AndroidUseEvent
import com.androiduse.autopilot.events.model.EventType

object EventHub {
    private const val TAG = "AndroidUseEventHub"

    // Single listener (The WebSocket Server)
    private var serverListener: ((AndroidUseEvent) -> Unit)? = null

    // TODO replace
    private var configManager: ConfigManager? = null

    fun init(config: ConfigManager) {
        this.configManager = config
    }

    fun subscribe(callback: (AndroidUseEvent) -> Unit) {
        serverListener = callback
    }

    fun emit(event: AndroidUseEvent) {
        // Check if this specific event type is enabled in config
        if (isEventEnabled(event.type)) {
            try {
                serverListener?.invoke(event)
            } catch (e: Exception) {
                Log.e(TAG, "Error broadcasting event: ${e.message}")
            }
        }
    }

    private fun isEventEnabled(type: EventType): Boolean {
        val config = configManager ?: return true // Default to true if config not loaded

        // Always allow PONG and UNKNOWN (debug)
        if (type == EventType.PONG || type == EventType.UNKNOWN) return true

        // Check ConfigManager for specific toggle
        // We'll implement this dynamic check in ConfigManager next
        return config.isEventEnabled(type)
    }
}