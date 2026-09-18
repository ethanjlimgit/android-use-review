package com.androiduse.autopilot.api

import android.accessibilityservice.AccessibilityService
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.util.Base64
import android.util.Log
import android.view.KeyEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.core.net.toUri
import com.androiduse.autopilot.core.ElementFinder
import com.androiduse.autopilot.core.StateRepository
import com.androiduse.autopilot.input.AndroidUseKeyboardIME
import com.androiduse.autopilot.service.AndroidUseAccessibilityService
import com.androiduse.autopilot.service.GestureController
import com.androiduse.autopilot.ui.MainActivity
import org.json.JSONArray
import org.json.JSONObject
import java.io.FilterInputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Handles all write/action API operations
 * Responsible for modifying device state, gestures, keyboard input, and app installation
 */
class ActionApiHandler(
    private val stateRepo: StateRepository,
    private val getKeyboardIME: () -> AndroidUseKeyboardIME?,
    private val getPackageManager: () -> PackageManager,
    private val context: Context,
    private val onAppsChanged: () -> Unit = {}
) {
    companion object {
        private const val TAG = "ActionApiHandler"
        private const val MAX_APK_BYTES = 2L * 1024 * 1024 * 1024 // 2 GB
        private const val INSTALL_FREE_SPACE_MARGIN_BYTES = 200L * 1024 * 1024 // 200 MiB
    }

    private val installLock = Any()

    /**
     * Size-limited input stream to prevent excessive APK downloads
     */
    private class SizeLimitedInputStream(
        inputStream: InputStream,
        private val maxBytes: Long,
    ) : FilterInputStream(inputStream) {
        private var totalRead: Long = 0

        private fun onBytesRead(count: Int) {
            if (count <= 0) return
            totalRead += count.toLong()
            if (totalRead > maxBytes)
                throw IOException("APK exceeds max allowed size ($maxBytes bytes)")
        }

        override fun read(): Int {
            val value = super.read()
            if (value != -1) onBytesRead(1)
            return value
        }

        override fun read(b: ByteArray, off: Int, len: Int): Int {
            val count = super.read(b, off, len)
            if (count > 0) onBytesRead(count)
            return count
        }
    }

    /**
     * Get available internal storage in bytes
     */
    private fun getAvailableInternalBytes(): Long? {
        return try {
            StatFs(Environment.getDataDirectory().absolutePath).availableBytes
        } catch (e: Exception) {
            Log.w(TAG, "Failed to read free space", e)
            null
        }
    }

    // ==================== Keyboard Actions ====================

    /**
     * Input text via keyboard IME or accessibility service
     */
    fun keyboardInput(base64Text: String, clear: Boolean): ApiResponse {
        val ime = getKeyboardIME()
        if (ime != null) {
            if (ime.inputB64Text(base64Text, clear)) {
                return ApiResponse.Success("input done via IME (clear=$clear)")
            }
        }

        // Fallback to accessibility services if IME is not active or failed
        try {
            val textBytes = Base64.decode(base64Text, Base64.DEFAULT)
            val text = String(textBytes, java.nio.charset.StandardCharsets.UTF_8)

            if (stateRepo.inputText(text, clear))
                return ApiResponse.Success("input done via Accessibility (clear=$clear)")

        } catch (e: Exception) {
            Log.e("ApiHandler", "Accessibility input fallback failed: ${e.message}")
        }

        return ApiResponse.Error("input failed (IME not active and Accessibility fallback failed)")
    }

    /**
     * Clear all text from the focused input field
     */
    fun keyboardClear(): ApiResponse {
        val ime = getKeyboardIME()

        if (ime != null && ime.hasInputConnection()) {
            if (ime.clearText()) {
                return ApiResponse.Success("Text cleared via IME")
            }
            Log.w(TAG, "IME clearText() failed, falling back to Accessibility")
        }

        return if (stateRepo.inputText("", clear = true)) {
            ApiResponse.Success("Text cleared via Accessibility")
        } else {
            ApiResponse.Error("Clear failed (IME not active and Accessibility fallback failed)")
        }
    }

    /**
     * Send a key event (back, home, enter, delete, etc.)
     */
    @Suppress("DEPRECATION")
    fun keyboardKey(keyCode: Int): ApiResponse {
        // Prefer global actions for system navigation keys, with and without IME
        val globalAction = when (keyCode) {
            KeyEvent.KEYCODE_BACK -> AccessibilityService.GLOBAL_ACTION_BACK
            KeyEvent.KEYCODE_HOME -> AccessibilityService.GLOBAL_ACTION_HOME
            KeyEvent.KEYCODE_APP_SWITCH -> AccessibilityService.GLOBAL_ACTION_RECENTS
            else -> null
        }
        if (globalAction != null) {
            return performGlobalAction(globalAction)
        }

        // Handle ENTER without IME
        if (keyCode == KeyEvent.KEYCODE_ENTER) {
            val state = stateRepo.getPhoneState()
            val focusedNode = state.focusedElement

            try {
                if (focusedNode != null) {
                    if (focusedNode.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.id)) {
                        return ApiResponse.Success("Enter performed via Accessibility")
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Accessibility enter failed", e)
            } finally {
                try {
                    focusedNode?.recycle()
                } catch (_: Exception) {
                }
            }

            // Fallback: some multiline fields accept newline via ACTION_SET_TEXT.
            return if (stateRepo.inputText("\n", clear = false))
                ApiResponse.Success("Newline inserted via Accessibility")
            else
                ApiResponse.Error("Enter failed (IME not active and Accessibility fallback failed)")
        }

        // Handle DELETE without IME
        if (keyCode == KeyEvent.KEYCODE_DEL) {
            val state = stateRepo.getPhoneState()
            val focusedNode = state.focusedElement

            val currentText: String?
            val hintText: String?
            try {
                currentText = focusedNode?.text?.toString()
                hintText = focusedNode?.hintText?.toString()
            } catch (e: Exception) {
                Log.w(TAG, "Failed to read focused text for delete", e)
                return ApiResponse.Error("Delete failed (could not read focused text)")
            } finally {
                try {
                    focusedNode?.recycle()
                } catch (_: Exception) {
                }
            }

            val effectiveText =
                if (!hintText.isNullOrEmpty() && currentText == hintText) "" else currentText.orEmpty()

            if (effectiveText.isEmpty())
                return ApiResponse.Success("Delete noop (field is empty)")

            val updatedText = effectiveText.dropLast(1)
            return if (stateRepo.inputText(updatedText, clear = true))
                ApiResponse.Success("Delete performed via Accessibility")
            else
                ApiResponse.Error("Delete failed (IME not active and Accessibility fallback failed)")
        }

        // For other keys, require IME
        val ime = getKeyboardIME()
            ?: return ApiResponse.Error(
                "AndroidUseKeyboardIME not active or available. Use keyboard/input for text, or supported keys like back/home/recents/enter/delete."
            )

        if (!ime.hasInputConnection()) {
            return ApiResponse.Error("No input connection available - keyboard may not be focused on an input field")
        }

        return if (ime.sendKeyEventDirect(keyCode)) {
            ApiResponse.Success("Key event sent via IME - code: $keyCode")
        } else {
            ApiResponse.Error("Failed to send key event via IME")
        }
    }

    // ==================== Overlay Actions ====================

    /**
     * Set the overlay vertical offset
     */
    fun setOverlayOffset(offset: Int): ApiResponse {
        return if (stateRepo.setOverlayOffset(offset)) {
            ApiResponse.Success("Overlay offset updated to $offset")
        } else {
            ApiResponse.Error("Failed to update overlay offset")
        }
    }

    /**
     * Set overlay visibility
     */
    fun setOverlayVisible(visible: Boolean): ApiResponse {
        return if (stateRepo.setOverlayVisible(visible)) {
            ApiResponse.Success("Overlay visibility set to $visible")
        } else {
            ApiResponse.Error("Failed to set overlay visibility")
        }
    }

    // ==================== Gesture Actions ====================

    /**
     * Perform a tap gesture at the specified coordinates
     */
    fun performTap(x: Int, y: Int): ApiResponse {
        return if (GestureController.tap(x, y)) {
            ApiResponse.Success("Tap performed at ($x, $y)")
        } else {
            ApiResponse.Error("Failed to perform tap at ($x, $y)")
        }
    }

    /**
     * Perform a swipe gesture
     */
    fun performSwipe(startX: Int, startY: Int, endX: Int, endY: Int, duration: Int): ApiResponse {
        return if (GestureController.swipe(startX, startY, endX, endY, duration)) {
            ApiResponse.Success("Swipe performed")
        } else {
            ApiResponse.Error("Failed to perform swipe")
        }
    }

    /**
     * Perform a global action (back, home, recents, etc.)
     */
    fun performGlobalAction(action: Int): ApiResponse {
        return if (GestureController.performGlobalAction(action)) {
            ApiResponse.Success("Global action $action performed")
        } else {
            ApiResponse.Error("Failed to perform global action $action")
        }
    }

    // ==================== Semantic Element Actions ====================

    /**
     * Find an element by criteria and tap it.
     */
    fun findAndClick(by: String, pattern: String): ApiResponse {
        val result = ElementFinder.findElement(by, pattern)
            ?: return ApiResponse.Error("Element not found: by=$by, pattern='$pattern'")

        return if (GestureController.tap(result.x, result.y)) {
            ApiResponse.Success("${result.description} - tapped at (${result.x}, ${result.y})")
        } else {
            ApiResponse.Error("Found element but tap failed at (${result.x}, ${result.y})")
        }
    }

    /**
     * Find an element by criteria, tap to focus it, then input text.
     */
    fun findAndInput(by: String, pattern: String, base64Text: String, clear: Boolean): ApiResponse {
        val result = ElementFinder.findElement(by, pattern)
            ?: return ApiResponse.Error("Element not found: by=$by, pattern='$pattern'")

        // Tap to focus the element
        if (!GestureController.tap(result.x, result.y)) {
            return ApiResponse.Error("Found element but tap-to-focus failed at (${result.x}, ${result.y})")
        }

        // Small delay for focus to register
        Thread.sleep(200)

        // Now input the text
        return keyboardInput(base64Text, clear)
    }

    /**
     * Find an element by criteria and long press it.
     */
    fun findAndLongPress(by: String, pattern: String): ApiResponse {
        val result = ElementFinder.findElement(by, pattern)
            ?: return ApiResponse.Error("Element not found: by=$by, pattern='$pattern'")

        // Long press is simulated as a swipe from same point to same point with duration
        return if (GestureController.swipe(result.x, result.y, result.x, result.y, 1000)) {
            ApiResponse.Success("${result.description} - long pressed at (${result.x}, ${result.y})")
        } else {
            ApiResponse.Error("Found element but long press failed at (${result.x}, ${result.y})")
        }
    }

    // ==================== App Actions ====================

    /**
     * Start an app by package name and optional activity name
     */
    fun startApp(packageName: String, activityName: String? = null): ApiResponse {
        val service = AndroidUseAccessibilityService.getInstance()
            ?: return ApiResponse.Error("Accessibility Service not available")

        return try {
            val intent = if (!activityName.isNullOrEmpty() && activityName != "null") {
                Intent().apply {
                    setClassName(
                        packageName,
                        if (activityName.startsWith(".")) packageName + activityName else activityName
                    )
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            } else {
                service.packageManager.getLaunchIntentForPackage(packageName)?.apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            }

            if (intent != null) {
                service.startActivity(intent)
                ApiResponse.Success("Started app $packageName")
            } else {
                Log.e(
                    TAG,
                    "Could not create intent for $packageName - getLaunchIntentForPackage returned null. Trying fallback."
                )

                try {
                    val fallbackIntent = Intent(Intent.ACTION_MAIN)
                    fallbackIntent.addCategory(Intent.CATEGORY_LAUNCHER)
                    fallbackIntent.setPackage(packageName)
                    fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

                    if (fallbackIntent.resolveActivity(service.packageManager) != null) {
                        service.startActivity(fallbackIntent)
                        ApiResponse.Success("Started app $packageName (fallback)")
                    } else {
                        ApiResponse.Error("Could not create intent for $packageName")
                    }
                } catch (e2: Exception) {
                    Log.e(TAG, "Fallback start failed", e2)
                    ApiResponse.Error("Could not create intent for $packageName")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting app", e)
            ApiResponse.Error("Error starting app: ${e.message}")
        }
    }

    /**
     * Install an app from an input stream
     */
    fun installApp(
        apkStream: InputStream,
        hideOverlay: Boolean = false,
        expectedSizeBytes: Long = -1L,
    ): ApiResponse {
        return try {
            if (!context.packageManager.canRequestPackageInstalls()) {
                Log.e(
                    TAG,
                    "Install permission not granted (canRequestPackageInstalls = false)"
                )
                return ApiResponse.Error("Install permission denied. Please enable 'Install unknown apps' for AndroidUse in Settings.")
            }

            if (expectedSizeBytes > MAX_APK_BYTES) {
                return ApiResponse.Error("APK too large: $expectedSizeBytes bytes (max $MAX_APK_BYTES)")
            }

            if (expectedSizeBytes > 0) {
                val availableBytes = getAvailableInternalBytes()
                if (availableBytes != null) {
                    val requiredBytes = expectedSizeBytes + INSTALL_FREE_SPACE_MARGIN_BYTES
                    if (availableBytes < requiredBytes) {
                        return ApiResponse.Error(
                            "Insufficient storage: need ~$requiredBytes bytes, have $availableBytes bytes"
                        )
                    }
                }
            }

            val packageInstaller = getPackageManager().packageInstaller
            val params =
                PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
            val sessionId = packageInstaller.createSession(params)
            val session = packageInstaller.openSession(sessionId)

            session.use {
                val writeSize = if (expectedSizeBytes > 0) expectedSizeBytes else -1L
                val out = it.openWrite("base_apk", 0, writeSize)
                var totalBytes = 0L
                apkStream.use { rawInput ->
                    val input = SizeLimitedInputStream(rawInput, MAX_APK_BYTES)
                    val buffer = ByteArray(65536)
                    var c: Int
                    while (input.read(buffer).also { c = it } != -1) {
                        out.write(buffer, 0, c)
                        totalBytes += c
                    }
                }
                session.fsync(out)
                out.close()
                Log.i(TAG, "Written $totalBytes decoded bytes to install session")

                val latch = CountDownLatch(1)
                var success = false
                var errorMsg = ""
                var confirmationLaunched = false
                val shouldHideOverlay = hideOverlay && stateRepo.isOverlayVisible()
                var receiverRegistered = false

                val receiver = object : BroadcastReceiver() {
                    override fun onReceive(c: Context?, intent: Intent?) {
                        val status =
                            intent?.getIntExtra(
                                PackageInstaller.EXTRA_STATUS,
                                PackageInstaller.STATUS_FAILURE
                            )
                        val message = intent?.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)

                        Log.d(TAG, "Install Status Received: $status, Message: $message")

                        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                            val confirmationIntent =
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                    intent?.getParcelableExtra(
                                        Intent.EXTRA_INTENT,
                                        Intent::class.java
                                    )
                                } else {
                                    @Suppress("DEPRECATION")
                                    (intent?.getParcelableExtra(Intent.EXTRA_INTENT))
                                }

                            if (confirmationIntent == null) {
                                errorMsg = "Install confirmation intent missing"
                                latch.countDown()
                                return
                            }

                            if (!confirmationLaunched) {
                                confirmationIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                try {
                                    context.startActivity(confirmationIntent)
                                } catch (e: Exception) {
                                    errorMsg = "Failed to launch install confirmation: ${e.message}"
                                    latch.countDown()
                                }
                            }
                            return
                        }

                        if (status == PackageInstaller.STATUS_SUCCESS) {
                            success = true
                            latch.countDown()
                            return
                        }

                        errorMsg = message ?: "Unknown error (Status Code: $status)"
                        if (status == PackageInstaller.STATUS_FAILURE_INVALID) errorMsg += " [INVALID]"
                        if (status == PackageInstaller.STATUS_FAILURE_INCOMPATIBLE) errorMsg += " [INCOMPATIBLE]"
                        if (status == PackageInstaller.STATUS_FAILURE_STORAGE) errorMsg += " [STORAGE]"
                        latch.countDown()
                    }
                }

                val action = "com.androiduse.autopilot.INSTALL_COMPLETE_$sessionId"
                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    sessionId,
                    Intent(action).setPackage(context.packageName),
                    PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )

                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        context.registerReceiver(
                            receiver,
                            IntentFilter(action),
                            Context.RECEIVER_NOT_EXPORTED
                        )
                    } else {
                        @Suppress("DEPRECATION")
                        context.registerReceiver(receiver, IntentFilter(action))
                    }
                    receiverRegistered = true

                    if (shouldHideOverlay) {
                        Log.i(TAG, "Hiding overlay to prevent Tapjacking protection...")
                        stateRepo.setOverlayVisible(false)
                    }

                    // Bring the app to the foreground
                    Log.i(TAG, "Bringing app to foreground for install prompt...")
                    val foregroundIntent =
                        Intent(context, MainActivity::class.java).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                        }
                    context.startActivity(foregroundIntent)

                    try {
                        Thread.sleep(1000)
                    } catch (ignored: InterruptedException) {
                    }

                    Log.i(TAG, "Committing install session...")
                    it.commit(pendingIntent.intentSender)

                    val completed =
                        latch.await(3, TimeUnit.MINUTES) // timeout for user interaction
                    if (!completed && errorMsg.isBlank()) {
                        errorMsg = "Timed out waiting for install result"
                    }
                } finally {
                    if (receiverRegistered) {
                        try {
                            context.unregisterReceiver(receiver)
                        } catch (e: Exception) {
                            Log.w(TAG, "Failed to unregister install receiver", e)
                        }
                    }
                    if (shouldHideOverlay) {
                        stateRepo.setOverlayVisible(true)
                    }
                }

                if (success) {
                    // Notify that apps have changed
                    onAppsChanged()
                    ApiResponse.Success("App installed successfully")
                } else {
                    ApiResponse.Error("Install failed: $errorMsg")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Install failed", e)
            ApiResponse.Error("Install exception: ${e.message}")
        }
    }

    /**
     * Install apps from a list of URLs
     */
    fun installFromUrls(urls: List<String>, hideOverlay: Boolean = false): ApiResponse {
        if (urls.isEmpty()) return ApiResponse.Error("No APK URLs provided")

        if (!context.packageManager.canRequestPackageInstalls()) {
            return ApiResponse.Error(
                "Install permission denied. Please enable 'Install unknown apps' for AndroidUse in Settings."
            )
        }

        val results = JSONArray()
        var successCount = 0
        val uniqueUrls = urls.map { it.trim() }.filter { it.isNotEmpty() }.distinct()

        synchronized(installLock) {
            for (urlString in uniqueUrls) {
                val result = JSONObject().apply { put("url", urlString) }

                try {
                    val uri = urlString.toUri()
                    val scheme = uri.scheme?.lowercase()
                    if (scheme != "https" && scheme != "http") {
                        result.put("success", false)
                        result.put("error", "Unsupported URL scheme: ${scheme ?: "null"}")
                        results.put(result)
                        continue
                    }

                    val connection = (URL(urlString).openConnection() as HttpURLConnection).apply {
                        instanceFollowRedirects = true
                        connectTimeout = 15_000
                        readTimeout = 60_000
                        requestMethod = "GET"
                        setRequestProperty(
                            "Accept",
                            "application/vnd.android.package-archive,application/octet-stream,*/*"
                        )
                    }

                    try {
                        val code = connection.responseCode
                        if (code !in 200..299) {
                            val errorBody =
                                connection.errorStream?.bufferedReader()?.use { reader ->
                                    val text = reader.readText()
                                    if (text.length > 2048) text.take(2048) else text
                                }
                            result.put("success", false)
                            result.put(
                                "error",
                                buildString {
                                    append("Download failed: HTTP $code")
                                    connection.responseMessage?.let { msg ->
                                        if (msg.isNotBlank()) append(" $msg")
                                    }
                                    if (!errorBody.isNullOrBlank()) append(": $errorBody")
                                }
                            )
                            results.put(result)
                            continue
                        }

                        val contentLength = connection.contentLengthLong

                        if (contentLength > MAX_APK_BYTES) {
                            result.put("success", false)
                            result.put(
                                "error",
                                "APK too large: $contentLength bytes (max $MAX_APK_BYTES)"
                            )
                            results.put(result)
                            continue
                        }

                        val availableBytes = getAvailableInternalBytes()
                        if (availableBytes != null) {
                            val requiredBytes = when {
                                contentLength > 0 -> contentLength + INSTALL_FREE_SPACE_MARGIN_BYTES
                                else -> INSTALL_FREE_SPACE_MARGIN_BYTES
                            }
                            if (availableBytes < requiredBytes) {
                                result.put("success", false)
                                result.put(
                                    "error",
                                    "Insufficient storage: need ~$requiredBytes bytes, have $availableBytes bytes"
                                )
                                results.put(result)
                                continue
                            }
                        }

                        val installResponse =
                            connection.inputStream.use { stream ->
                                installApp(stream, hideOverlay, expectedSizeBytes = contentLength)
                            }

                        when (installResponse) {
                            is ApiResponse.Success -> {
                                successCount += 1
                                result.put("success", true)
                                result.put("message", installResponse.data.toString())
                            }

                            is ApiResponse.Error -> {
                                result.put("success", false)
                                result.put("error", installResponse.message)
                            }

                            else -> {
                                result.put("success", false)
                                result.put(
                                    "error",
                                    "Unexpected install response: ${installResponse.javaClass.simpleName}"
                                )
                            }
                        }
                    } finally {
                        try {
                            connection.disconnect()
                        } catch (_: Exception) {
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Install from URL failed: $urlString", e)
                    result.put("success", false)
                    result.put("error", e.message ?: "Install from URL failed")
                }

                results.put(result)
            }
        }

        val summary = JSONObject().apply {
            put("overallSuccess", successCount == uniqueUrls.size)
            put("successCount", successCount)
            put("failureCount", uniqueUrls.size - successCount)
            put("results", results)
        }

        // Notify that apps have changed if any app was successfully installed
        if (successCount > 0) {
            onAppsChanged()
        }

        return ApiResponse.RawObject(summary)
    }
}
