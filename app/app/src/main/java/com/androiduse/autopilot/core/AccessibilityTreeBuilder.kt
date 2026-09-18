package com.androiduse.autopilot.core

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

/**
 * Utility class for building comprehensive JSON representations of accessibility trees
 */
object AccessibilityTreeBuilder {

    private const val MIN_ELEMENT_SIZE = 5

    private const val VISIBILITY_THRESHOLD = 0.01f  // 1% visibility threshold

    /**
     * Builds a compact JSON object from an AccessibilityNodeInfo node,
     * extracting only essential properties needed for UI automation.
     * Uses short field names to minimize network transfer size.
     * Optionally filters out nodes that are less than 1% visible on screen.
     *
     * @param node The AccessibilityNodeInfo to convert to JSON
     * @param screenBounds The visible screen bounds for filtering (null to disable filtering)
     * @return JSONObject containing essential node information, or null if filtered out
     */
    @Suppress("DEPRECATION")
    fun buildFullAccessibilityTreeJson(
        node: AccessibilityNodeInfo,
        screenBounds: Rect? = null
    ): JSONObject? {
        // Get bounds for this node
        val rect = Rect()
        node.getBoundsInScreen(rect)

        // Check this node's validity (only if filtering is enabled)
        val nodePassesFilter = if (screenBounds != null) {
            val visiblePercentage = getVisiblePercentage(rect, screenBounds)
            visiblePercentage >= VISIBILITY_THRESHOLD
        } else {
            true  // No filtering, always passes
        }

        // Process children FIRST (before deciding on this node)
        val childrenArray = JSONArray()
        for (i in 0 until node.childCount) {
            val child = node.getChild(i)
            if (child != null) {
                val childJson = buildFullAccessibilityTreeJson(child, screenBounds)
                if (childJson != null) {
                    childrenArray.put(childJson)
                }
            }
        }

        // Parent preservation: keep if passes filter OR has valid children
        if (!nodePassesFilter && childrenArray.length() == 0) {
            node.recycle()
            return null
        }

        // Build compact JSON with only essential properties
        // Field name mapping (compact -> full):
        // rid -> resourceId
        // cls -> className
        // pkg -> packageName
        // txt -> text
        // desc -> contentDescription
        // b -> boundsInScreen {l, t, r, b}
        // clk -> isClickable
        // edit -> isEditable
        // scrl -> isScrollable
        // enb -> isEnabled
        // ch -> children
        val result = JSONObject().apply {
            // Basic identification (3 fields)
            put("rid", node.viewIdResourceName ?: "")
            put("cls", node.className?.toString() ?: "")
            put("pkg", node.packageName?.toString() ?: "")

            // Text content (2 fields)
            put("txt", node.text?.toString() ?: "")
            put("desc", node.contentDescription?.toString() ?: "")

            // Bounds - compact format (1 field with 4 sub-fields)
            put("b", JSONObject().apply {
                put("l", rect.left)
                put("t", rect.top)
                put("r", rect.right)
                put("b", rect.bottom)
            })

            // Essential boolean states (4 fields)
            put("clk", node.isClickable)
            put("edit", node.isEditable)
            put("scrl", node.isScrollable)
            put("enb", node.isEnabled)

            // Children (1 field)
            put("ch", childrenArray)
        }

        node.recycle()
        return result
    }

    private fun getVisiblePercentage(rect: Rect, screenBounds: Rect): Float {
        val width = rect.width()
        val height = rect.height()
        val totalArea = width * height

        if (totalArea <= 0) return 0f

        // Check if element fully contains screen (overflow case)
        if (rect.left <= 0 && rect.top <= 0 &&
            rect.right >= screenBounds.right && rect.bottom >= screenBounds.bottom) {
            return 1f
        }

        // Calculate visible portion
        val visibleLeft = maxOf(rect.left, screenBounds.left)
        val visibleTop = maxOf(rect.top, screenBounds.top)
        val visibleRight = minOf(rect.right, screenBounds.right)
        val visibleBottom = minOf(rect.bottom, screenBounds.bottom)

        val visibleWidth = maxOf(0, visibleRight - visibleLeft)
        val visibleHeight = maxOf(0, visibleBottom - visibleTop)
        val visibleArea = visibleWidth * visibleHeight

        return visibleArea.toFloat() / totalArea.toFloat()
    }
}
