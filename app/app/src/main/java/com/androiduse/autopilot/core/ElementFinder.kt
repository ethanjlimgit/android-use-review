package com.androiduse.autopilot.core

import android.graphics.Rect
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo
import com.androiduse.autopilot.service.AndroidUseAccessibilityService
import java.util.regex.Pattern

/**
 * Searches the live accessibility tree for elements matching criteria.
 * Returns center coordinates of matching elements for semantic actions.
 */
object ElementFinder {
    private const val TAG = "ElementFinder"

    data class FindResult(val x: Int, val y: Int, val description: String)

    /**
     * Find an element matching the given criteria and return its center coordinates.
     *
     * @param by Search field: "text" (text+contentDescription), "id" (resourceId), "desc" (contentDescription), "class" (className)
     * @param pattern Regex pattern to match (case-insensitive)
     * @return FindResult with center coordinates, or null if not found
     */
    fun findElement(by: String, pattern: String): FindResult? {
        val service = AndroidUseAccessibilityService.getInstance()
            ?: run {
                Log.e(TAG, "Accessibility service not available")
                return null
            }

        val root = service.rootInActiveWindow
            ?: run {
                Log.e(TAG, "No root window available")
                return null
            }

        val regex = try {
            Pattern.compile(pattern, Pattern.CASE_INSENSITIVE)
        } catch (e: Exception) {
            Log.e(TAG, "Invalid regex pattern: $pattern", e)
            root.recycle()
            return null
        }

        val result = searchTree(root, by, regex)
        if (result == null) {
            root.recycle()
        }
        return result
    }

    private fun searchTree(
        node: AccessibilityNodeInfo,
        by: String,
        regex: Pattern
    ): FindResult? {
        // Check if this node matches
        if (matchesNode(node, by, regex)) {
            val rect = Rect()
            node.getBoundsInScreen(rect)
            val x = (rect.left + rect.right) / 2
            val y = (rect.top + rect.bottom) / 2
            val desc = buildDescription(node, by)
            node.recycle()
            return FindResult(x, y, desc)
        }

        // Search children depth-first
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val result = searchTree(child, by, regex)
            if (result != null) {
                node.recycle()
                return result
            }
        }

        node.recycle()
        return null
    }

    private fun matchesNode(
        node: AccessibilityNodeInfo,
        by: String,
        regex: Pattern
    ): Boolean {
        return when (by.lowercase()) {
            "text" -> {
                val text = node.text?.toString() ?: ""
                val desc = node.contentDescription?.toString() ?: ""
                regex.matcher(text).find() || regex.matcher(desc).find()
            }
            "id" -> {
                val rid = node.viewIdResourceName ?: ""
                regex.matcher(rid).find()
            }
            "desc" -> {
                val desc = node.contentDescription?.toString() ?: ""
                regex.matcher(desc).find()
            }
            "class" -> {
                val cls = node.className?.toString() ?: ""
                regex.matcher(cls).find()
            }
            else -> {
                Log.w(TAG, "Unknown search field: $by")
                false
            }
        }
    }

    private fun buildDescription(node: AccessibilityNodeInfo, by: String): String {
        val text = node.text?.toString() ?: ""
        val desc = node.contentDescription?.toString() ?: ""
        val rid = node.viewIdResourceName ?: ""
        val cls = node.className?.toString()?.substringAfterLast('.') ?: ""
        return "Found $cls (text='$text', desc='$desc', id='$rid') by=$by"
    }
}
