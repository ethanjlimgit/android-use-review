package com.androiduse.autopilot.analytics

import android.os.Build
import android.util.Log
import com.androiduse.autopilot.BuildConfig
import com.posthog.PostHog

/**
 * Centralized analytics manager for PostHog event tracking
 *
 * Usage:
 * AnalyticsManager.capture("event_name", mapOf("key" to "value"))
 */
object AnalyticsManager {

    private const val TAG = "AnalyticsManager"
    private var initializationWarningShown = false

    /**
     * Capture an event with optional properties
     */
    fun capture(event: String, properties: Map<String, Any>? = null) {
        try {
            PostHog.capture(
                event = event,
                properties = properties
            )
            if (BuildConfig.DEBUG) {
                Log.d(TAG, "✓ Event captured: $event ${properties?.let { "| properties: $it" } ?: ""}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "✗ Error capturing event: $event", e)
            if (e.message?.contains("not initialized") == true && !initializationWarningShown) {
                Log.e(TAG, "!!! PostHog is not initialized. Events will not be sent.")
                initializationWarningShown = true
            }
        }
    }

    /**
     * Capture an event with automatic context enrichment (app version, device info)
     */
    fun captureWithContext(event: String, properties: Map<String, Any>? = null) {
        val enrichedProperties = mutableMapOf<String, Any>()

        // Add app context
        enrichedProperties["app_version"] = BuildConfig.VERSION_NAME
        enrichedProperties["app_build"] = BuildConfig.VERSION_CODE
        enrichedProperties["environment"] = BuildConfig.DEFAULT_ENVIRONMENT

        // Add device context
        enrichedProperties["os_version"] = Build.VERSION.SDK_INT
        enrichedProperties["device_model"] = "${Build.MANUFACTURER} ${Build.MODEL}"

        // Merge with provided properties (user properties take precedence)
        properties?.let { enrichedProperties.putAll(it) }

        capture(event, enrichedProperties)
    }

    /**
     * Identify user with unique ID and optional properties
     */
    fun identify(userId: String, properties: Map<String, Any>? = null) {
        try {
            PostHog.identify(
                distinctId = userId,
                userProperties = properties
            )
            Log.d(TAG, "User identified: $userId")
        } catch (e: Exception) {
            Log.e(TAG, "Error identifying user: $userId", e)
        }
    }

    /**
     * Reset analytics session (call on logout)
     */
    fun reset() {
        try {
            PostHog.reset()
            Log.d(TAG, "Analytics session reset")
            initializationWarningShown = false // Reset warning flag
        } catch (e: Exception) {
            Log.e(TAG, "Error resetting analytics session", e)
        }
    }

    /**
     * Send a test event to verify PostHog is working
     * Useful for debugging
     */
    fun sendTestEvent() {
        capture("posthog_test_event", mapOf(
            "timestamp" to System.currentTimeMillis(),
            "test" to true,
            "debug" to BuildConfig.DEBUG
        ))
        Log.d(TAG, "Test event sent - check PostHog dashboard")
    }

    /**
     * Get debug information about analytics state
     */
    fun getDebugInfo(): String {
        return buildString {
            appendLine("AnalyticsManager Debug Info:")
            appendLine("  Build Type: ${BuildConfig.BUILD_TYPE}")
            appendLine("  Debug Mode: ${BuildConfig.DEBUG}")
            appendLine("  App Version: ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})")
            appendLine("  Environment: ${BuildConfig.DEFAULT_ENVIRONMENT}")
            appendLine("")
            appendLine("To test PostHog:")
            appendLine("  1. Enable debug logging: Check logcat for 'PostHog' or 'AnalyticsManager'")
            appendLine("  2. Send test event: AnalyticsManager.sendTestEvent()")
            appendLine("  3. Check PostHog dashboard: https://us.i.posthog.com")
            appendLine("  4. Look for '✓' in logcat when events are captured")
        }
    }
}
