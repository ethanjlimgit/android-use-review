package com.androiduse.autopilot.service

import android.accessibilityservice.AccessibilityService
import android.graphics.Bitmap
import android.os.Build
import android.os.Handler
import android.util.Base64
import android.util.Log
import android.view.Display
import com.androiduse.autopilot.ui.overlay.OverlayManager
import java.io.ByteArrayOutputStream
import java.util.concurrent.CompletableFuture
import java.util.concurrent.Executors

/**
 * Manages screenshot capture functionality for the accessibility service
 * Handles overlay visibility, screenshot capture, and base64 encoding
 */
class ScreenshotManager(
    private val service: AccessibilityService,
    private val overlayManager: OverlayManager,
    private val mainHandler: Handler
) {
    companion object {
        private const val TAG = "ScreenshotManager"
        private const val SCREENSHOT_TIMEOUT_SECONDS = 5L
    }

    /**
     * Take a screenshot and return as base64-encoded string
     * @param hideOverlay Whether to temporarily hide the overlay during capture
     * @return CompletableFuture with base64-encoded PNG or error message
     */
    fun takeScreenshotBase64(hideOverlay: Boolean = true): CompletableFuture<String> {
        val future = CompletableFuture<String>()

        // Temporarily hide overlay if requested
        val wasOverlayDrawingEnabled = if (hideOverlay) {
            val enabled = overlayManager.isDrawingEnabled()
            overlayManager.setDrawingEnabled(false)
            enabled
        } else {
            true
        }

        try {
            if (hideOverlay) {
                // Small delay to ensure overlay is hidden before screenshot
                mainHandler.postDelayed({
                    performScreenshotCapture(future, wasOverlayDrawingEnabled, hideOverlay)
                }, 100)
            } else {
                performScreenshotCapture(future, wasOverlayDrawingEnabled, hideOverlay)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error taking screenshot", e)
            future.complete("error: Failed to take screenshot: ${e.message}")

            // Restore overlay drawing state in case of exception
            if (hideOverlay) {
                overlayManager.setDrawingEnabled(wasOverlayDrawingEnabled)
            }
        }

        return future
    }

    /**
     * Perform the actual screenshot capture
     */
    private fun performScreenshotCapture(
        future: CompletableFuture<String>,
        wasOverlayDrawingEnabled: Boolean,
        hideOverlay: Boolean
    ) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            future.complete("error: Screenshot API requires Android 11 (API 30) or higher")
            if (hideOverlay) {
                overlayManager.setDrawingEnabled(wasOverlayDrawingEnabled)
            }
            return
        }

        try {
            service.takeScreenshot(
                Display.DEFAULT_DISPLAY,
                mainHandler.looper.thread.contextClassLoader?.let {
                    Executors.newSingleThreadExecutor()
                } ?: Executors.newSingleThreadExecutor(),
                object : AccessibilityService.TakeScreenshotCallback {
                    override fun onSuccess(screenshotResult: AccessibilityService.ScreenshotResult) {
                        try {
                            val bitmap = Bitmap.wrapHardwareBuffer(
                                screenshotResult.hardwareBuffer,
                                screenshotResult.colorSpace
                            )

                            if (bitmap == null) {
                                Log.e(TAG, "Failed to create bitmap from hardware buffer")
                                screenshotResult.hardwareBuffer.close()
                                future.complete("error: Failed to create bitmap from screenshot data")
                                return
                            }

                            val byteArrayOutputStream = ByteArrayOutputStream()
                            val compressionSuccess = bitmap.compress(
                                Bitmap.CompressFormat.PNG,
                                100,
                                byteArrayOutputStream,
                            )

                            screenshotResult.hardwareBuffer.close()

                            if (!compressionSuccess) {
                                Log.e(TAG, "Failed to compress bitmap to PNG")
                                future.complete("error: Failed to compress screenshot")
                                return
                            }

                            val byteArray = byteArrayOutputStream.toByteArray()
                            val base64String = Base64.encodeToString(byteArray, Base64.NO_WRAP)

                            future.complete(base64String)
                            Log.d(TAG, "Screenshot captured successfully (${byteArray.size} bytes)")

                        } catch (e: Exception) {
                            Log.e(TAG, "Error processing screenshot", e)
                            future.complete("error: Failed to process screenshot: ${e.message}")
                        } finally {
                            // Restore overlay drawing state
                            if (hideOverlay) {
                                mainHandler.post {
                                    overlayManager.setDrawingEnabled(wasOverlayDrawingEnabled)
                                }
                            }
                        }
                    }

                    override fun onFailure(errorCode: Int) {
                        val errorMsg = when (errorCode) {
                            AccessibilityService.ERROR_TAKE_SCREENSHOT_INTERNAL_ERROR ->
                                "Internal error occurred"
                            AccessibilityService.ERROR_TAKE_SCREENSHOT_NO_ACCESSIBILITY_ACCESS ->
                                "No accessibility access"
                            AccessibilityService.ERROR_TAKE_SCREENSHOT_INTERVAL_TIME_SHORT ->
                                "Screenshot interval too short"
                            AccessibilityService.ERROR_TAKE_SCREENSHOT_INVALID_DISPLAY ->
                                "Invalid display"
                            else -> "Unknown error (code: $errorCode)"
                        }

                        Log.e(TAG, "Screenshot failed: $errorMsg")
                        future.complete("error: Screenshot failed: $errorMsg")

                        // Restore overlay drawing state
                        if (hideOverlay) {
                            mainHandler.post {
                                overlayManager.setDrawingEnabled(wasOverlayDrawingEnabled)
                            }
                        }
                    }
                }
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error initiating screenshot", e)
            future.complete("error: Failed to initiate screenshot: ${e.message}")

            // Restore overlay drawing state
            if (hideOverlay) {
                overlayManager.setDrawingEnabled(wasOverlayDrawingEnabled)
            }
        }
    }
}
