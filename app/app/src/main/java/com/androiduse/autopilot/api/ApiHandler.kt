package com.androiduse.autopilot.api

import android.content.Context
import android.content.pm.PackageManager
import com.androiduse.autopilot.core.StateRepository
import com.androiduse.autopilot.input.AndroidUseKeyboardIME
import java.io.InputStream

/**
 * Main API handler that acts as a facade for query and action operations
 * Delegates to QueryApiHandler and ActionApiHandler for actual implementation
 */
class ApiHandler(
    private val stateRepo: StateRepository,
    private val getKeyboardIME: () -> AndroidUseKeyboardIME?,
    private val getPackageManager: () -> PackageManager,
    private val appVersionProvider: () -> String,
    private val context: Context,
) {
    // Delegate handlers
    private val queryHandler: QueryApiHandler = QueryApiHandler(
        stateRepo = stateRepo,
        getPackageManager = getPackageManager,
        appVersionProvider = appVersionProvider
    )

    private val actionHandler: ActionApiHandler = ActionApiHandler(
        stateRepo = stateRepo,
        getKeyboardIME = getKeyboardIME,
        getPackageManager = getPackageManager,
        context = context,
        onAppsChanged = { queryHandler.invalidateAppsCache() }
    )

    // ==================== Query Operations (Read-only) ====================

    fun ping() = queryHandler.ping()

    fun getTree() = queryHandler.getTree()

    fun getTreeFull(filter: Boolean) = queryHandler.getTreeFull(filter)

    fun getPhoneState() = queryHandler.getPhoneState()

    fun getState() = queryHandler.getState()

    fun getStateFull(filter: Boolean) = queryHandler.getStateFull(filter)

    fun getVersion() = queryHandler.getVersion()

    fun getPackages() = queryHandler.getPackages()

    fun getTime() = queryHandler.getTime()

    fun getDate() = queryHandler.getDate()

    fun getApps(includeSystem: Boolean = true) = queryHandler.getApps(includeSystem)

    fun invalidateAppsCache() = queryHandler.invalidateAppsCache()

    fun preloadAppsCache() = queryHandler.preloadAppsCache()

    fun getScreenshot(hideOverlay: Boolean) = queryHandler.getScreenshot(hideOverlay)

    // ==================== Action Operations (Write/Modify) ====================

    fun keyboardInput(base64Text: String, clear: Boolean) =
        actionHandler.keyboardInput(base64Text, clear)

    fun keyboardClear() = actionHandler.keyboardClear()

    fun keyboardKey(keyCode: Int) = actionHandler.keyboardKey(keyCode)

    fun setOverlayOffset(offset: Int) = actionHandler.setOverlayOffset(offset)

    fun setOverlayVisible(visible: Boolean) = actionHandler.setOverlayVisible(visible)

    fun performTap(x: Int, y: Int) = actionHandler.performTap(x, y)

    fun performSwipe(startX: Int, startY: Int, endX: Int, endY: Int, duration: Int) =
        actionHandler.performSwipe(startX, startY, endX, endY, duration)

    fun performGlobalAction(action: Int) = actionHandler.performGlobalAction(action)

    fun findAndClick(by: String, pattern: String) =
        actionHandler.findAndClick(by, pattern)

    fun findAndInput(by: String, pattern: String, base64Text: String, clear: Boolean) =
        actionHandler.findAndInput(by, pattern, base64Text, clear)

    fun findAndLongPress(by: String, pattern: String) =
        actionHandler.findAndLongPress(by, pattern)

    fun startApp(packageName: String, activityName: String? = null) =
        actionHandler.startApp(packageName, activityName)

    fun installApp(
        apkStream: InputStream,
        hideOverlay: Boolean = false,
        expectedSizeBytes: Long = -1L,
    ) = actionHandler.installApp(apkStream, hideOverlay, expectedSizeBytes)

    fun installFromUrls(urls: List<String>, hideOverlay: Boolean = false) =
        actionHandler.installFromUrls(urls, hideOverlay)
}
