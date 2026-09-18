package com.androiduse.autopilot.service

import android.util.Log
import com.androiduse.autopilot.model.ElementNode
import com.androiduse.autopilot.ui.overlay.OverlayManager

/**
 * Handles building and adding UI element hierarchies to the overlay
 * Processes element trees recursively to maintain parent-child relationships
 */
class OverlayElementBuilder(
    private val overlayManager: OverlayManager
) {
    companion object {
        private const val TAG = "OverlayElementBuilder"
    }

    /**
     * Add an element and all its children to the overlay recursively
     * Maintains depth information for hierarchical display
     *
     * @param element The root element to add
     * @param depth The current depth in the hierarchy (0 for root)
     */
    fun addElementAndChildrenToOverlay(element: ElementNode, depth: Int = 0) {
        try {
            // Add the current element
            overlayManager.addElement(
                text = element.text,
                rect = element.rect,
                type = element.className,
                index = element.overlayIndex
            )

            // Recursively add all children
            for (child in element.children) {
                addElementAndChildrenToOverlay(child, depth + 1)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error adding element to overlay: ${e.message}", e)
        }
    }

    /**
     * Add multiple root elements and their children to the overlay
     *
     * @param elements List of root elements to add
     */
    fun addElementsToOverlay(elements: List<ElementNode>) {
        try {
            elements.forEach { rootElement ->
                addElementAndChildrenToOverlay(rootElement, 0)
            }
            Log.d(TAG, "Added ${elements.size} root elements to overlay")
        } catch (e: Exception) {
            Log.e(TAG, "Error adding elements to overlay: ${e.message}", e)
        }
    }

    /**
     * Clear all elements from the overlay
     */
    fun clearOverlay() {
        try {
            overlayManager.clearElements()
            overlayManager.refreshOverlay()
            Log.d(TAG, "Cleared overlay")
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing overlay: ${e.message}", e)
        }
    }

    /**
     * Refresh the overlay display
     */
    fun refreshOverlay() {
        try {
            overlayManager.refreshOverlay()
        } catch (e: Exception) {
            Log.e(TAG, "Error refreshing overlay: ${e.message}", e)
        }
    }
}
