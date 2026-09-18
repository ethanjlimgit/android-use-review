package com.androiduse.autopilot.config

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import androidx.core.content.edit
import com.androiduse.autopilot.core.SingletonHolder
import com.androiduse.autopilot.events.model.EventType
import com.androiduse.autopilot.paywall.TaskLimitManager
import com.androiduse.autopilot.BuildConfig

/**
 * Centralized configuration manager for AndroidUse
 * Handles SharedPreferences operations and provides a clean API for configuration management
 */
class ConfigManager private constructor(private val context: Context) {

    companion object : SingletonHolder<ConfigManager, Context>(
        { ctx -> ConfigManager(ctx.applicationContext) }
    ) {
        private const val PREFS_NAME = "androiduse_config"
        private const val KEY_OVERLAY_VISIBLE = "overlay_visible"
        private const val KEY_OVERLAY_OFFSET = "overlay_offset"
        private const val KEY_AUTO_OFFSET_ENABLED = "auto_offset_enabled"
        private const val KEY_AUTO_OFFSET_CALCULATED = "auto_offset_calculated"
        private const val KEY_SOCKET_SERVER_ENABLED = "socket_server_enabled"
        private const val KEY_SOCKET_SERVER_PORT = "socket_server_port"

        // WebSocket & Events
        private const val KEY_WEBSOCKET_ENABLED = "websocket_enabled"
        private const val KEY_WEBSOCKET_PORT = "websocket_port"
        private const val PREFIX_EVENT_ENABLED = "event_enabled_"
        private const val KEY_DEVICE_ID = "device_id"

        // Backend WebSocket Client
        private const val KEY_BACKEND_WS_ENABLED = "backend_ws_enabled"
        private const val KEY_BACKEND_WS_HOST = "backend_ws_host"
        private const val KEY_BACKEND_WS_PORT = "backend_ws_port"

        // Server Environment
        private const val KEY_SERVER_ENVIRONMENT = "server_environment"
        private const val KEY_AUTH_SERVER_URL = "auth_server_url"

        // Onboarding
        private const val KEY_ONBOARDING_COMPLETE = "onboarding_complete"
        private const val KEY_SURVEY_COMPLETE = "survey_complete"

        // Event Sound
        private const val KEY_EVENT_SOUND_ENABLED = "event_sound_enabled"

        // Floating Button
        private const val KEY_FLOATING_BUTTON_DISMISSED = "floating_button_dismissed"

        // Speech Recognition
        private const val KEY_SPEECH_LANGUAGE = "speech_language"
        private const val DEFAULT_SPEECH_LANGUAGE = "" // Empty means use device default

        // Real-time Voice Command
        private const val KEY_REALTIME_VOICE_COMMAND = "realtime_voice_command_enabled"

        private const val DEFAULT_OFFSET = 0
        private const val DEFAULT_SOCKET_PORT = 8080
        private const val DEFAULT_WEBSOCKET_PORT = 8081
    }

    private val sharedPrefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // Device ID - set after user authentication
    var deviceId: String
        get() = sharedPrefs.getString(KEY_DEVICE_ID, null) ?: ""
        set(value) {
            sharedPrefs.edit { putString(KEY_DEVICE_ID, value) }
        }

    // Onboarding completion status
    var isOnboardingComplete: Boolean
        get() = sharedPrefs.getBoolean(KEY_ONBOARDING_COMPLETE, false)
        set(value) {
            sharedPrefs.edit { putBoolean(KEY_ONBOARDING_COMPLETE, value) }
        }

    // Survey completion status
    var isSurveyComplete: Boolean
        get() = sharedPrefs.getBoolean(KEY_SURVEY_COMPLETE, false)
        set(value) {
            sharedPrefs.edit { putBoolean(KEY_SURVEY_COMPLETE, value) }
        }

    // Event sound enabled - play sound on UI changes
    var eventSoundEnabled: Boolean
        get() = sharedPrefs.getBoolean(KEY_EVENT_SOUND_ENABLED, false)
        set(value) {
            sharedPrefs.edit { putBoolean(KEY_EVENT_SOUND_ENABLED, value) }
        }

    // Overlay visibility
    var overlayVisible: Boolean
        get() = sharedPrefs.getBoolean(KEY_OVERLAY_VISIBLE, false)
        set(value) {
            sharedPrefs.edit { putBoolean(KEY_OVERLAY_VISIBLE, value) }
        }

    // Floating button dismissed state
    var floatingButtonDismissed: Boolean
        get() = sharedPrefs.getBoolean(KEY_FLOATING_BUTTON_DISMISSED, false)
        set(value) {
            sharedPrefs.edit { putBoolean(KEY_FLOATING_BUTTON_DISMISSED, value) }
        }

    // Speech Recognition Language
    // Empty string means use device default locale
    // Otherwise, use BCP 47 language tag (e.g., "en-US", "zh-CN", "ja-JP")
    var speechLanguage: String
        get() = sharedPrefs.getString(KEY_SPEECH_LANGUAGE, DEFAULT_SPEECH_LANGUAGE) ?: DEFAULT_SPEECH_LANGUAGE
        set(value) {
            sharedPrefs.edit { putString(KEY_SPEECH_LANGUAGE, value) }
        }

    // Real-time Voice Command Mode
    // When enabled, tasks are submitted with voice_command_enabled=true
    // This enables real-time transcription and TTS responses from the agent
    // Requires RECORD_AUDIO permission and microphone access
    var realtimeVoiceCommandEnabled: Boolean
        get() = sharedPrefs.getBoolean(KEY_REALTIME_VOICE_COMMAND, false)
        set(value) {
            sharedPrefs.edit { putBoolean(KEY_REALTIME_VOICE_COMMAND, value) }
        }

    // Overlay offset
    var overlayOffset: Int
        get() = sharedPrefs.getInt(KEY_OVERLAY_OFFSET, DEFAULT_OFFSET)
        set(value) {
            sharedPrefs.edit { putInt(KEY_OVERLAY_OFFSET, value) }
        }

    // Auto offset enabled
    var autoOffsetEnabled: Boolean
        get() = sharedPrefs.getBoolean(KEY_AUTO_OFFSET_ENABLED, true)
        set(value) {
            sharedPrefs.edit { putBoolean(KEY_AUTO_OFFSET_ENABLED, value) }
        }

    // Track if auto offset has been calculated before
    var autoOffsetCalculated: Boolean
        get() = sharedPrefs.getBoolean(KEY_AUTO_OFFSET_CALCULATED, false)
        set(value) {
            sharedPrefs.edit { putBoolean(KEY_AUTO_OFFSET_CALCULATED, value) }
        }

    // Socket server enabled (REST API)
    var socketServerEnabled: Boolean
        get() = sharedPrefs.getBoolean(KEY_SOCKET_SERVER_ENABLED, false)
        set(value) {
            sharedPrefs.edit { putBoolean(KEY_SOCKET_SERVER_ENABLED, value) }
        }

    // Socket server port (REST API)
    var socketServerPort: Int
        get() = sharedPrefs.getInt(KEY_SOCKET_SERVER_PORT, DEFAULT_SOCKET_PORT)
        set(value) {
            sharedPrefs.edit { putInt(KEY_SOCKET_SERVER_PORT, value) }
        }

    // WebSocket Server Enabled
    var websocketEnabled: Boolean
        get() = sharedPrefs.getBoolean(KEY_WEBSOCKET_ENABLED, true)
        set(value) {
            sharedPrefs.edit { putBoolean(KEY_WEBSOCKET_ENABLED, value) }
        }

    // WebSocket Server Port
    var websocketPort: Int
        get() = sharedPrefs.getInt(KEY_WEBSOCKET_PORT, DEFAULT_WEBSOCKET_PORT)
        set(value) {
            sharedPrefs.edit().putInt(KEY_WEBSOCKET_PORT, value).apply()
        }

    val deviceName: String
        get() {
            val manufacturer = Build.MANUFACTURER
            val model = Build.MODEL

            return if (model.startsWith(manufacturer)) {
                capitalize(model)
            } else {
                capitalize(manufacturer) + " " + model
            }
        }

    fun capitalize(str: String): String {
        return str.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
    }

    val deviceCountryCode: String
        get() {
            // TODO:
            return "de"
        }

    val userID: String
        get() {
            return "7785b089-b9aa-458d-a32e-baec315e5e16"
        }

    // Backend WebSocket Client Configuration
    var backendWsEnabled: Boolean
        get() = sharedPrefs.getBoolean(KEY_BACKEND_WS_ENABLED, BuildConfig.DEFAULT_ENVIRONMENT != "dev")
        set(value) {
            sharedPrefs.edit { putBoolean(KEY_BACKEND_WS_ENABLED, value) }
        }

    var backendWsHost: String
        get() = sharedPrefs.getString(KEY_BACKEND_WS_HOST, BuildConfig.DEFAULT_WS_HOST) ?: BuildConfig.DEFAULT_WS_HOST
        set(value) {
            sharedPrefs.edit { putString(KEY_BACKEND_WS_HOST, value) }
        }

    var backendWsPort: Int
        get() = sharedPrefs.getInt(KEY_BACKEND_WS_PORT, BuildConfig.DEFAULT_WS_PORT)
        set(value) {
            sharedPrefs.edit { putInt(KEY_BACKEND_WS_PORT, value) }
        }

    // Server Environment: dev, staging, or production
    var serverEnvironment: String
        get() = sharedPrefs.getString(KEY_SERVER_ENVIRONMENT, BuildConfig.DEFAULT_ENVIRONMENT) ?: BuildConfig.DEFAULT_ENVIRONMENT
        set(value) {
            sharedPrefs.edit { putString(KEY_SERVER_ENVIRONMENT, value) }
        }

    // Auth Server URL
    var authServerUrl: String
        get() = sharedPrefs.getString(KEY_AUTH_SERVER_URL, BuildConfig.DEFAULT_AUTH_URL) ?: BuildConfig.DEFAULT_AUTH_URL
        set(value) {
            sharedPrefs.edit { putString(KEY_AUTH_SERVER_URL, value) }
        }

    // Dynamic Event Toggles
    fun isEventEnabled(type: EventType): Boolean {
        // Default all events to true unless explicitly disabled
        return sharedPrefs.getBoolean(PREFIX_EVENT_ENABLED + type.name, true)
    }

    fun setEventEnabled(type: EventType, enabled: Boolean) {
        sharedPrefs.edit { putBoolean(PREFIX_EVENT_ENABLED + type.name, enabled) }
        // We could notify listeners here if needed, but usually this is polled by EventHub
    }

    // Listener interface for configuration changes
    interface ConfigChangeListener {
        fun onOverlayVisibilityChanged(visible: Boolean)
        fun onOverlayOffsetChanged(offset: Int)

        // New WebSocket listeners
        fun onWebSocketEnabledChanged(enabled: Boolean) {}
        fun onWebSocketPortChanged(port: Int) {}

        // Backend WebSocket Client listeners
        fun onBackendWsEnabledChanged(enabled: Boolean) {}
        fun onBackendWsHostChanged(host: String) {}
        fun onBackendWsConnectionStatusChanged(status: String) {}
    }

    private val listeners = mutableSetOf<ConfigChangeListener>()

    fun addListener(listener: ConfigChangeListener) {
        listeners.add(listener)
    }

    fun removeListener(listener: ConfigChangeListener) {
        listeners.remove(listener)
    }

    fun setOverlayVisibleWithNotification(visible: Boolean) {
        overlayVisible = visible
        listeners.forEach { it.onOverlayVisibilityChanged(visible) }
    }

    fun setOverlayOffsetWithNotification(offset: Int) {
        overlayOffset = offset
        listeners.forEach { it.onOverlayOffsetChanged(offset) }
    }

    fun setWebSocketEnabledWithNotification(enabled: Boolean) {
        websocketEnabled = enabled
        listeners.forEach { it.onWebSocketEnabledChanged(enabled) }
    }

    fun setWebSocketPortWithNotification(port: Int) {
        websocketPort = port
        listeners.forEach { it.onWebSocketPortChanged(port) }
    }

    fun setBackendWsEnabledWithNotification(enabled: Boolean) {
        backendWsEnabled = enabled
        listeners.forEach { it.onBackendWsEnabledChanged(enabled) }
    }

    fun setBackendWsHostWithNotification(host: String) {
        backendWsHost = host
        listeners.forEach { it.onBackendWsHostChanged(host) }
    }

    fun notifyBackendWsConnectionStatus(status: String) {
        listeners.forEach { it.onBackendWsConnectionStatusChanged(status) }
    }

    // Bulk configuration update
    fun updateConfiguration(
        overlayVisible: Boolean? = null,
        overlayOffset: Int? = null,
        autoOffsetEnabled: Boolean? = null,
        socketServerEnabled: Boolean? = null,
        socketServerPort: Int? = null,
        websocketEnabled: Boolean? = null,
        websocketPort: Int? = null
    ) {
        val editor = sharedPrefs.edit()
        var hasChanges = false

        overlayVisible?.let {
            editor.putBoolean(KEY_OVERLAY_VISIBLE, it)
            hasChanges = true
        }

        overlayOffset?.let {
            editor.putInt(KEY_OVERLAY_OFFSET, it)
            hasChanges = true
        }

        autoOffsetEnabled?.let {
            editor.putBoolean(KEY_AUTO_OFFSET_ENABLED, it)
            hasChanges = true
        }

        socketServerEnabled?.let {
            editor.putBoolean(KEY_SOCKET_SERVER_ENABLED, it)
            hasChanges = true
        }

        socketServerPort?.let {
            editor.putInt(KEY_SOCKET_SERVER_PORT, it)
            hasChanges = true
        }

        websocketEnabled?.let {
            editor.putBoolean(KEY_WEBSOCKET_ENABLED, it)
            hasChanges = true
        }

        websocketPort?.let {
            editor.putInt(KEY_WEBSOCKET_PORT, it)
            hasChanges = true
        }

        if (hasChanges) {
            editor.apply()

            // Notify listeners
            overlayVisible?.let {
                listeners.forEach { listener ->
                    listener.onOverlayVisibilityChanged(
                        it
                    )
                }
            }
            overlayOffset?.let { listeners.forEach { listener -> listener.onOverlayOffsetChanged(it) } }
            websocketEnabled?.let {
                listeners.forEach { listener ->
                    listener.onWebSocketEnabledChanged(
                        it
                    )
                }
            }
            websocketPort?.let { listeners.forEach { listener -> listener.onWebSocketPortChanged(it) } }
        }
    }

    // Get all configuration as a data class
    data class Configuration(
        val overlayVisible: Boolean,
        val overlayOffset: Int,
        val autoOffsetEnabled: Boolean,
        val autoOffsetCalculated: Boolean,
        val socketServerEnabled: Boolean,
        val socketServerPort: Int,
        val websocketEnabled: Boolean,
        val websocketPort: Int,
        val backendWsEnabled: Boolean,
        val backendWsHost: String,
        val backendWsPort: Int,
        val serverEnvironment: String,
        val authServerUrl: String
    )

    fun getCurrentConfiguration(): Configuration {
        return Configuration(
            overlayVisible = overlayVisible,
            overlayOffset = overlayOffset,
            autoOffsetEnabled = autoOffsetEnabled,
            autoOffsetCalculated = autoOffsetCalculated,
            socketServerEnabled = socketServerEnabled,
            socketServerPort = socketServerPort,
            websocketEnabled = websocketEnabled,
            websocketPort = websocketPort,
            backendWsEnabled = backendWsEnabled,
            backendWsHost = backendWsHost,
            backendWsPort = backendWsPort,
            serverEnvironment = serverEnvironment,
            authServerUrl = authServerUrl
        )
    }

    /**
     * Reset task limit data for new user session
     * Call when user logs out or session is cleared
     */
    fun resetTaskLimitForNewUser() {
        try {
            val taskLimitManager = TaskLimitManager.Companion.getInstance(context)
            taskLimitManager.resetForNewUser()
            Log.d("ConfigManager", "Task limit data reset")
        } catch (e: Exception) {
            Log.e("ConfigManager", "Error resetting task limit: ${e.message}", e)
        }
    }
}