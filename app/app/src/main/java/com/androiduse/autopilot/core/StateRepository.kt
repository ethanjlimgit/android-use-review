package com.androiduse.autopilot.core

import android.graphics.Rect
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import com.androiduse.autopilot.model.ElementNode
import com.androiduse.autopilot.model.PhoneState
import com.androiduse.autopilot.service.AndroidUseAccessibilityService
import org.json.JSONObject
import java.util.concurrent.CompletableFuture

class StateRepository(private val service: AndroidUseAccessibilityService) {

    companion object {
        private const val TAG = "StateRepository"
    }

    fun getVisibleElements(): List<ElementNode> = service.getVisibleElements()

    fun getFullTree(filter: Boolean): JSONObject? {
        return try {
            // Try to get root from active window first
            var root = service.rootInActiveWindow

            // If no active window, try to find root from available windows
            if (root == null) {
                Log.d(TAG, "rootInActiveWindow is null, trying to get root from windows")
                root = getRootFromWindows()
            }

            if (root == null) {
                Log.w(TAG, "Could not get root from any window")
                return null
            }

            val bounds = if (filter) service.getScreenBounds() else null
            AccessibilityTreeBuilder.buildFullAccessibilityTreeJson(root, bounds)
        } catch (e: Exception) {
            Log.e(TAG, "Error building accessibility tree: ${e.message}", e)
            null
        }
    }

    /**
     * Try to get root node from available windows when rootInActiveWindow is null.
     * This can happen during window transitions or when our overlay is on top.
     */
    private fun getRootFromWindows(): AccessibilityNodeInfo? {
        try {
            val windows = service.windows ?: return null
            val ourPackage = service.packageName

            // Priority: TYPE_APPLICATION windows that are not our own package
            var appWindow: AccessibilityWindowInfo? = null
            var anyWindow: AccessibilityWindowInfo? = null

            for (window in windows) {
                // Skip our own overlay windows
                val windowRoot = window.root
                val windowPackage = windowRoot?.packageName?.toString()

                if (windowPackage != null && windowPackage == ourPackage) {
                    windowRoot?.recycle()
                    continue
                }

                // Prefer application type windows
                if (window.type == AccessibilityWindowInfo.TYPE_APPLICATION) {
                    if (appWindow == null) {
                        appWindow = window
                    }
                } else if (anyWindow == null && window.type != AccessibilityWindowInfo.TYPE_INPUT_METHOD) {
                    anyWindow = window
                }
                windowRoot?.recycle()
            }

            // Get root from the best window we found
            val targetWindow = appWindow ?: anyWindow
            val result = targetWindow?.root

            // Recycle windows
            windows.forEach { it.recycle() }

            if (result != null) {
                Log.d(TAG, "Got root from window: ${result.packageName}")
            }

            return result
        } catch (e: Exception) {
            Log.e(TAG, "Error getting root from windows: ${e.message}", e)
            return null
        }
    }

    fun getPhoneState(): PhoneState = service.getPhoneState()

    fun getDeviceContext(): JSONObject = service.getDeviceContext()

    fun getScreenBounds(): Rect = service.getScreenBounds()

    fun setOverlayOffset(offset: Int): Boolean = service.setOverlayOffset(offset)

    fun setOverlayVisible(visible: Boolean): Boolean = service.setOverlayVisible(visible)

    fun isOverlayVisible(): Boolean = service.isOverlayVisible()

    fun takeScreenshot(hideOverlay: Boolean): CompletableFuture<String> =
        service.takeScreenshotBase64(hideOverlay)

    fun inputText(text: String, clear: Boolean): Boolean = service.inputText(text, clear)
}
