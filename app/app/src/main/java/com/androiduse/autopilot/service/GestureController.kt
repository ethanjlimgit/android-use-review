package com.androiduse.autopilot.service

import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.util.Log

/**
 * Controller for executing gestures and global actions via AccessibilityService.
 * eliminating the need for ADB 'input' commands.
 */
object GestureController {
    private const val TAG = "GestureController"
    private const val TAP_DURATION_MS = 50L
    private const val DEFAULT_SWIPE_DURATION_MS = 300
    private const val MIN_SWIPE_DURATION_MS = 10
    private const val MAX_SWIPE_DURATION_MS = 5000
    private const val SWIPE_END_PAUSE_MS = 100L // Pause at end point

    /**
     * Perform a tap at specific coordinates.
     */
    fun tap(x: Int, y: Int): Boolean {
        val service = AndroidUseAccessibilityService.getInstance() ?: return false

        return try {
            val path = Path().apply { moveTo(x.toFloat(), y.toFloat()) }
            val stroke = GestureDescription.StrokeDescription(path, 0, TAP_DURATION_MS)
            val gesture = GestureDescription.Builder().addStroke(stroke).build()

            val result = service.dispatchGesture(gesture, null, null)
            Log.d(TAG, "Tap at ($x, $y) dispatched: $result")
            result
        } catch (e: Exception) {
            Log.e(TAG, "Tap error", e)
            false
        }
    }

    /**
     * Perform a swipe from (startX, startY) to (endX, endY).
     * The gesture includes a pause at the end point for better gesture recognition.
     */
    fun swipe(
        startX: Int,
        startY: Int,
        endX: Int,
        endY: Int,
        durationMs: Int = DEFAULT_SWIPE_DURATION_MS,
    ): Boolean {
        val service = AndroidUseAccessibilityService.getInstance() ?: return false

        return try {
            // Clamp duration to reasonable limits for a swipe
            val dur = durationMs.coerceIn(MIN_SWIPE_DURATION_MS, MAX_SWIPE_DURATION_MS)
            val totalDuration = dur.toLong() + SWIPE_END_PAUSE_MS

            // Create a single continuous path: swipe from start to end, then pause at end
            val path = Path().apply {
                moveTo(startX.toFloat(), startY.toFloat())
                lineTo(endX.toFloat(), endY.toFloat())
            }

            // Single stroke with total duration (movement + pause at end)
            val stroke = GestureDescription.StrokeDescription(path, 0, totalDuration)

            // Build gesture with single stroke
            val gesture = GestureDescription.Builder()
                .addStroke(stroke)
                .build()

            val result = service.dispatchGesture(gesture, null, null)
            Log.d(TAG, "Swipe ($startX,$startY)->($endX,$endY) with ${SWIPE_END_PAUSE_MS}ms pause dispatched: $result")
            result
        } catch (e: Exception) {
            Log.e(TAG, "Swipe error", e)
            false
        }
    }

    /**
     * Perform a global action (Home, Back, Recents, etc.)
     *
     * @param action The global action constant (e.g. AccessibilityService.GLOBAL_ACTION_HOME)
     */
    fun performGlobalAction(action: Int): Boolean {
        val service = AndroidUseAccessibilityService.getInstance() ?: return false

        return try {
            val result = service.performGlobalAction(action)
            Log.d(TAG, "Global Action $action performed: $result")
            result
        } catch (e: Exception) {
            Log.e(TAG, "Global action error", e)
            false
        }
    }
}
