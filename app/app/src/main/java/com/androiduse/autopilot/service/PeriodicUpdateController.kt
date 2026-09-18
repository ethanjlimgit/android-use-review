package com.androiduse.autopilot.service

import android.os.Handler
import android.util.Log
import com.androiduse.autopilot.config.ConfigManager
import com.androiduse.autopilot.model.ElementNode
import com.androiduse.autopilot.ui.overlay.OverlayManager
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Manages periodic refresh of visible UI elements for the accessibility service
 * Handles throttled updates, overlay synchronization, and element management
 */
class PeriodicUpdateController(
    private val configManager: ConfigManager,
    private val overlayManager: OverlayManager,
    private val mainHandler: Handler
) {
    companion object {
        private const val TAG = "PeriodicUpdateController"
        private const val REFRESH_INTERVAL_MS = 250L // Update every 250ms
        private const val MIN_FRAME_TIME_MS = 16L // Minimum time between frames (roughly 60 FPS)
    }

    // State
    private val isProcessing = AtomicBoolean(false)
    private var lastUpdateTime = 0L
    private var isStarted = false
    private var currentPackageName: String = ""

    // Callbacks
    var onGetVisibleElements: (() -> List<ElementNode>)? = null
    var onAddElementToOverlay: ((ElementNode, Int) -> Unit)? = null
    var onClearElementList: (() -> Unit)? = null

    /**
     * Periodic update runnable - refreshes elements at regular intervals
     */
    private val updateRunnable = object : Runnable {
        override fun run() {
            if (configManager.overlayVisible) {
                val currentTime = System.currentTimeMillis()
                val timeSinceLastUpdate = currentTime - lastUpdateTime

                if (timeSinceLastUpdate >= MIN_FRAME_TIME_MS) {
                    refreshVisibleElements()
                    lastUpdateTime = currentTime
                }
            }
            mainHandler.postDelayed(this, REFRESH_INTERVAL_MS)
        }
    }

    /**
     * Start periodic updates
     */
    fun startPeriodicUpdates() {
        if (isStarted) {
            Log.w(TAG, "Periodic updates already started")
            return
        }

        lastUpdateTime = System.currentTimeMillis()
        mainHandler.postDelayed(updateRunnable, REFRESH_INTERVAL_MS)
        isStarted = true
        Log.d(TAG, "Started periodic updates")
    }

    /**
     * Stop periodic updates
     */
    fun stopPeriodicUpdates() {
        if (!isStarted) {
            return
        }

        mainHandler.removeCallbacks(updateRunnable)
        isStarted = false
        Log.d(TAG, "Stopped periodic updates")
    }

    /**
     * Set current package name for element filtering
     */
    fun setCurrentPackageName(packageName: String) {
        currentPackageName = packageName
    }

    /**
     * Get current package name
     */
    fun getCurrentPackageName(): String = currentPackageName

    /**
     * Refresh visible elements and update overlay
     */
    fun refreshVisibleElements() {
        if (!isProcessing.compareAndSet(false, true)) {
            return // Already processing
        }

        try {
            if (currentPackageName.isEmpty()) {
                overlayManager.clearElements()
                overlayManager.refreshOverlay()
                return
            }

            // Clear previous elements
            onClearElementList?.invoke()

            // Get fresh elements from the service
            val elements = onGetVisibleElements?.invoke() ?: emptyList()

            // Update overlay if visible
            if (configManager.overlayVisible && elements.isNotEmpty()) {
                overlayManager.clearElements()

                elements.forEach { rootElement ->
                    onAddElementToOverlay?.invoke(rootElement, 0)
                }

                overlayManager.refreshOverlay()
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error refreshing visible elements: ${e.message}", e)
        } finally {
            isProcessing.set(false)
        }
    }

    /**
     * Reset overlay state (called on package change)
     */
    fun resetOverlayState() {
        try {
            overlayManager.clearElements()
            overlayManager.refreshOverlay()
            onClearElementList?.invoke()
            Log.d(TAG, "Reset overlay state for package change")
        } catch (e: Exception) {
            Log.e(TAG, "Error resetting overlay state: ${e.message}", e)
        }
    }

    /**
     * Check if currently processing an update
     */
    fun isCurrentlyProcessing(): Boolean = isProcessing.get()

    /**
     * Trigger immediate refresh (useful when showing overlay)
     */
    fun triggerImmediateRefresh() {
        mainHandler.post {
            refreshVisibleElements()
        }
    }
}
