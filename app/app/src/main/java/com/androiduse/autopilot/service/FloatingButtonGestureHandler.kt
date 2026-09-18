package com.androiduse.autopilot.service

import android.content.Context
import android.graphics.PixelFormat
import android.graphics.Rect
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import com.androiduse.autopilot.R
import kotlin.math.sqrt

/**
 * Handles gesture recognition and dragging for the floating button
 * Includes drag-to-dismiss with trash zone
 */
class FloatingButtonGestureHandler(
    private val context: Context,
    private val windowManager: WindowManager
) {
    companion object {
        private const val TAG = "FloatingButtonGesture"
        private const val CLICK_THRESHOLD_PX = 10
        private const val TRASH_ZONE_THRESHOLD_PX = 100
    }

    // Trash zone for drag-to-dismiss
    private var trashZoneView: View? = null
    private var trashZoneParams: WindowManager.LayoutParams? = null
    private var isInTrashZone = false

    // Track which side the button is on
    private var isOnRightSide = true

    // Drag state
    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var isDragging = false

    // Callbacks
    var onButtonClicked: (() -> Unit)? = null
    var onButtonDismissed: (() -> Unit)? = null

    // Store references for layout updates
    private var containerView: View? = null
    private var containerParams: WindowManager.LayoutParams? = null

    /**
     * Setup drag listeners for the floating button
     * @param touchTargetView The view to attach touch listener to (the button itself)
     * @param containerView The parent view added to WindowManager (for layout updates)
     * @param buttonParams The layout params for the container view
     */
    fun setupDragListeners(
        touchTargetView: View?,
        containerView: View?,
        buttonParams: WindowManager.LayoutParams?
    ) {
        this.containerView = containerView
        this.containerParams = buttonParams

        touchTargetView?.setOnTouchListener { view, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = buttonParams?.x ?: 0
                    initialY = buttonParams?.y ?: 0
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    isDragging = false
                    true
                }

                MotionEvent.ACTION_MOVE -> {
                    val deltaX = event.rawX - initialTouchX
                    val deltaY = event.rawY - initialTouchY

                    // Check if moved beyond threshold
                    val distance = sqrt(deltaX * deltaX + deltaY * deltaY)
                    if (!isDragging && distance > CLICK_THRESHOLD_PX) {
                        isDragging = true
                        showTrashZone()
                    }

                    if (isDragging) {
                        buttonParams?.x = initialX + deltaX.toInt()
                        buttonParams?.y = initialY + deltaY.toInt()

                        // Check if over trash zone
                        val wasInTrash = isInTrashZone
                        isInTrashZone = isOverTrashZone(event.rawX, event.rawY)

                        // Update trash zone visual feedback
                        if (wasInTrash != isInTrashZone) {
                            updateTrashZoneState(isInTrashZone)
                        }

                        // Update the container view's layout
                        containerView?.let { windowManager.updateViewLayout(it, buttonParams) }
                    }
                    true
                }

                MotionEvent.ACTION_UP -> {
                    val totalDeltaX = event.rawX - initialTouchX
                    val totalDeltaY = event.rawY - initialTouchY
                    val totalDistance = sqrt(totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY)
                    Log.d(TAG, "ACTION_UP: isDragging=$isDragging, totalDistance=$totalDistance, threshold=$CLICK_THRESHOLD_PX")

                    if (isDragging) {
                        Log.d(TAG, "ACTION_UP: was dragging")
                        hideTrashZone()

                        if (isInTrashZone) {
                            // Dismiss the floating button
                            Log.d(TAG, "Button dismissed to trash zone")
                            onButtonDismissed?.invoke()
                        } else {
                            // Snap to nearest edge
                            snapToNearestEdge(touchTargetView, buttonParams)
                        }
                        isInTrashZone = false
                    } else {
                        // It was a click
                        Log.d(TAG, "ACTION_UP: was a click (distance=$totalDistance < threshold=$CLICK_THRESHOLD_PX)")
                        Log.d(TAG, "onButtonClicked callback is null? ${onButtonClicked == null}")
                        view.performClick()
                        onButtonClicked?.invoke()
                        Log.d(TAG, "onButtonClicked callback invoked successfully")
                    }
                    isDragging = false
                    true
                }

                else -> false
            }
        }
    }

    /**
     * Snap button to nearest edge
     */
    private fun snapToNearestEdge(
        buttonView: View?,
        buttonParams: WindowManager.LayoutParams?
    ) {
        val displayMetrics = context.resources.displayMetrics
        val screenWidth = displayMetrics.widthPixels
        val currentX = buttonParams?.x ?: 0

        // Determine which edge is closer (using button view width for calculation)
        val distanceToLeft = currentX
        val distanceToRight = screenWidth - currentX - (buttonView?.width ?: 0)

        if (distanceToLeft < distanceToRight) {
            // Snap to left
            buttonParams?.x = 0
            isOnRightSide = false
        } else {
            // Snap to right
            buttonParams?.x = screenWidth - (buttonView?.width ?: 0)
            isOnRightSide = true
        }

        // Update the container view's layout
        containerView?.let {
            windowManager.updateViewLayout(it, buttonParams)
        }

        Log.d(TAG, "Snapped to ${if (isOnRightSide) "right" else "left"} edge")
    }

    /**
     * Create the trash zone view
     */
    fun createTrashZone() {
        if (trashZoneView != null) return

        try {
            val inflater = LayoutInflater.from(context)
            trashZoneView = inflater.inflate(R.layout.trash_zone_overlay, null)

            trashZoneParams = WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                y = 50
            }

            trashZoneView?.visibility = View.GONE
            windowManager.addView(trashZoneView, trashZoneParams)
            Log.d(TAG, "Trash zone created")
        } catch (e: Exception) {
            Log.e(TAG, "Error creating trash zone: ${e.message}", e)
        }
    }

    /**
     * Show trash zone
     */
    private fun showTrashZone() {
        trashZoneView?.visibility = View.VISIBLE
        Log.d(TAG, "Trash zone shown")
    }

    /**
     * Hide trash zone
     */
    private fun hideTrashZone() {
        trashZoneView?.visibility = View.GONE
        Log.d(TAG, "Trash zone hidden")
    }

    /**
     * Check if button is over trash zone
     */
    private fun isOverTrashZone(rawX: Float, rawY: Float): Boolean {
        val trashView = trashZoneView ?: return false

        val location = IntArray(2)
        trashView.getLocationOnScreen(location)

        val trashRect = Rect(
            location[0] - TRASH_ZONE_THRESHOLD_PX,
            location[1] - TRASH_ZONE_THRESHOLD_PX,
            location[0] + trashView.width + TRASH_ZONE_THRESHOLD_PX,
            location[1] + trashView.height + TRASH_ZONE_THRESHOLD_PX
        )

        return trashRect.contains(rawX.toInt(), rawY.toInt())
    }

    /**
     * Update trash zone visual state
     */
    private fun updateTrashZoneState(isActive: Boolean) {
        trashZoneView?.alpha = if (isActive) 1.0f else 0.6f
        trashZoneView?.scaleX = if (isActive) 1.2f else 1.0f
        trashZoneView?.scaleY = if (isActive) 1.2f else 1.0f
    }

    /**
     * Check which side the button is on
     */
    fun isButtonOnRightSide(): Boolean = isOnRightSide

    /**
     * Remove trash zone from window manager
     */
    fun destroy() {
        try {
            trashZoneView?.let { windowManager.removeView(it) }
            trashZoneView = null
            Log.d(TAG, "Gesture handler destroyed")
        } catch (e: Exception) {
            Log.e(TAG, "Error destroying gesture handler: ${e.message}", e)
        }
    }
}
