package com.androiduse.autopilot.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Rect
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.view.Display
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import com.androiduse.autopilot.model.ElementNode
import com.androiduse.autopilot.model.PhoneState
import com.androiduse.autopilot.api.ApiHandler
import com.androiduse.autopilot.core.StateRepository
import com.androiduse.autopilot.config.ConfigManager
import com.androiduse.autopilot.input.AndroidUseKeyboardIME
import com.androiduse.autopilot.ui.overlay.OverlayManager
import android.os.Handler
import android.os.Looper
import java.util.concurrent.CompletableFuture
import android.media.ToneGenerator
import android.media.AudioManager
import android.os.Bundle
import com.androiduse.autopilot.events.EventHub

// Event System Imports
import org.json.JSONObject
import kotlin.collections.forEach

@SuppressLint("AccessibilityPolicy")
class AndroidUseAccessibilityService : AccessibilityService(), ConfigManager.ConfigChangeListener {

    companion object {
        const val TAG = "AndroidUseAccessibility"
        private var instance: AndroidUseAccessibilityService? = null
        private const val MIN_ELEMENT_SIZE = 5

        fun getInstance(): AndroidUseAccessibilityService? = instance

        fun calculateInputText(
            currentText: String?,
            hintText: String?,
            newText: String,
            clear: Boolean
        ): String {
            if (clear) return newText

            val safeCurrentText = currentText.orEmpty()

            // If the current text matches the hint text, treat it as empty.
            if (hintText != null && safeCurrentText == hintText) return newText

            return safeCurrentText + newText
        }
    }

    private lateinit var overlayManager: OverlayManager
    private val screenBounds = Rect()
    private lateinit var configManager: ConfigManager
    private val mainHandler = Handler(Looper.getMainLooper())

    // Managers
    private lateinit var screenshotManager: ScreenshotManager
    private lateinit var periodicUpdateController: PeriodicUpdateController
    private lateinit var overlayElementBuilder: OverlayElementBuilder

    // Servers
    // TODO Make nullable
    private lateinit var actionDispatcher: ActionDispatcher

    // State
    private var isInitialized = false
    private var currentPackageName: String = ""
    private var currentActivityName: String = ""
    private val visibleElements = mutableListOf<ElementNode>()

    // Sound feedback
    private var toneGenerator: ToneGenerator? = null
    private var lastSoundTime = 0L
    private val SOUND_DEBOUNCE_MS = 100L // Minimum time between sounds

    override fun onCreate() {
        super.onCreate()
        overlayManager = OverlayManager(this)
        val windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        // TODO increase SDK version to 30
        val windowMetrics = windowManager.currentWindowMetrics
        val bounds = windowMetrics.bounds
        screenBounds.set(0, 0, bounds.width(), bounds.height())

        // Initialize ConfigManager
        configManager = ConfigManager.Companion.getInstance(this)
        configManager.addListener(this)

        // Initialize Event System
        EventHub.init(configManager)

        // Initialize managers
        screenshotManager = ScreenshotManager(this, overlayManager, mainHandler)
        overlayElementBuilder = OverlayElementBuilder(overlayManager)
        periodicUpdateController = PeriodicUpdateController(configManager, overlayManager, mainHandler)

        // Setup periodic update controller callbacks
        periodicUpdateController.onGetVisibleElements = {
            getVisibleElementsInternal()
        }
        periodicUpdateController.onAddElementToOverlay = { element, depth ->
            overlayElementBuilder.addElementAndChildrenToOverlay(element, depth)
        }
        periodicUpdateController.onClearElementList = {
            clearElementList()
        }

        // Initialize ActionDispatcher with ApiHandler
        val stateRepo = StateRepository(this)
        val apiHandler = ApiHandler(
            stateRepo,
            { AndroidUseKeyboardIME.Companion.getInstance() },
            { packageManager },
            {
                try {
                    packageManager.getPackageInfo(packageName, 0).versionName ?: "unknown"
                } catch (e: Exception) {
                    "unknown"
                }
            },
            this
        )

        actionDispatcher = ActionDispatcher(apiHandler)

        // Initialize sound feedback
        try {
            toneGenerator = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 50)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize ToneGenerator: ${e.message}")
        }

        isInitialized = true
    }

    override fun onServiceConnected() {
        super.onServiceConnected()

        // Check overlay permission before showing overlay
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!android.provider.Settings.canDrawOverlays(this)) {
                Log.w(TAG, "Overlay permission not granted. Overlay will not be shown.")
            } else {
                overlayManager.showOverlay()
            }
        } else {
            // Permission granted by default on older versions
            overlayManager.showOverlay()
        }

        instance = this

        serviceInfo = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPES_ALL_MASK

            packageNames = null

            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC

            // Set flags for better access
            flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                    AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS or
                    AccessibilityServiceInfo.FLAG_REQUEST_TOUCH_EXPLORATION_MODE

            // Enable screenshot capability (API 34+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                flags = flags or AccessibilityServiceInfo.FLAG_REQUEST_2_FINGER_PASSTHROUGH
            }
        }

        applyConfiguration()

        periodicUpdateController.startPeriodicUpdates()

        // Start BackendWebSocketService to ensure backend connectivity
        BackendServiceInitializer.ensureServiceStarted(this)

        // Auto-start FloatingButtonService if not dismissed
        startFloatingButtonIfNeeded()

        Log.d(TAG, "Accessibility service connected and configured")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val eventPackage = event?.packageName?.toString() ?: ""
        val eventClassName = event?.className?.toString() ?: ""

        // Detect package changes
        if (eventPackage.isNotEmpty() && eventPackage != currentPackageName && currentPackageName.isNotEmpty()) {
            periodicUpdateController.resetOverlayState()
        }

        if (eventPackage.isNotEmpty()) {
            currentPackageName = eventPackage
            periodicUpdateController.setCurrentPackageName(eventPackage)
        }

        // Capture activity name from TYPE_WINDOW_STATE_CHANGED events
        // These events typically indicate navigation to a new activity/screen
        if (event?.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            if (eventClassName.isNotEmpty() && !eventClassName.startsWith("android.")) {
                // Filter out Android system dialogs and only keep app activities
                currentActivityName = eventClassName
                Log.d(TAG, "Activity changed: $currentActivityName")
            }
        }

        // Trigger update on relevant events
        when (event?.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
                // Use a faster handling instead of clearing elements
                playEventSound()
            }
        }
    }

    /**
     * Play a short sound to provide auditory feedback for UI events
     * Debounced to prevent excessive sound playback
     */
    private fun playEventSound() {
        // Check if event sound is enabled in settings
        if (!configManager.eventSoundEnabled) {
            return
        }

        val currentTime = System.currentTimeMillis()
        if (currentTime - lastSoundTime < SOUND_DEBOUNCE_MS) {
            return
        }
        lastSoundTime = currentTime

        try {
            // Play a short beep (TONE_PROP_BEEP is a short, subtle tone)
            toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP, 50)
        } catch (e: Exception) {
            Log.e(TAG, "Error playing event sound: ${e.message}")
        }
    }

    private fun applyAutoOffset() {
        val autoOffset = overlayManager.calculateAutoOffset()
        configManager.overlayOffset = autoOffset
        overlayManager.setPositionOffsetY(autoOffset)
    }

    private fun clearElementList() {
        visibleElements.clear()
    }

    private fun applyConfiguration() {
        mainHandler.post {
            try {
                val config = configManager.getCurrentConfiguration()
                if (config.overlayVisible) {
                    overlayManager.showOverlay()
                } else {
                    overlayManager.hideOverlay()
                }

                // Apply offset: auto or manual
                val offsetToApply = if (config.autoOffsetEnabled) {
                    // Only calculate auto offset if it hasn't been calculated before
                    if (!config.autoOffsetCalculated) {
                        val autoOffset = overlayManager.calculateAutoOffset()
                        // Save the calculated auto offset back to ConfigManager
                        // so MainActivity can read the correct value
                        configManager.overlayOffset = autoOffset
                        // Mark that auto offset has been calculated
                        configManager.autoOffsetCalculated = true
                        Log.d(TAG, "Auto offset calculated for the first time: $autoOffset")
                        autoOffset
                    } else {
                        // Use the previously calculated/saved offset
                        val savedOffset = config.overlayOffset
                        Log.d(TAG, "Using previously calculated auto offset: $savedOffset")
                        savedOffset
                    }
                } else {
                    config.overlayOffset
                }

                overlayManager.setPositionOffsetY(offsetToApply)
            } catch (e: Exception) {
                Log.e(TAG, "Error applying configuration: ${e.message}", e)
            }
        }
    }

    // Public methods for MainActivity to call directly
    fun setOverlayVisible(visible: Boolean): Boolean {
        return try {
            configManager.overlayVisible = visible

            mainHandler.post {
                if (visible) {
                    // Check overlay permission before showing
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        if (!android.provider.Settings.canDrawOverlays(this)) {
                            Log.w(TAG, "Overlay permission not granted. Cannot show overlay.")
                            return@post
                        }
                    }

                    overlayManager.showOverlay()
                    // Trigger immediate refresh when showing overlay
                    periodicUpdateController.triggerImmediateRefresh()
                } else {
                    overlayManager.hideOverlay()
                }
            }

            Log.d(TAG, "Overlay visibility set to: $visible")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error setting overlay visibility: ${e.message}", e)
            false
        }
    }

    fun isOverlayVisible(): Boolean = configManager.overlayVisible

    fun setOverlayOffset(offset: Int): Boolean {
        return try {
            configManager.overlayOffset = offset

            mainHandler.post {
                overlayManager.setPositionOffsetY(offset)
            }

            Log.d(TAG, "Overlay offset set to: $offset")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error setting overlay offset: ${e.message}", e)
            false
        }
    }

    fun getOverlayOffset(): Int = configManager.overlayOffset

    fun getCurrentAppliedOffset(): Int = overlayManager.getPositionOffsetY()

    fun getScreenBounds(): Rect = screenBounds

    fun getActionDispatcher(): ActionDispatcher = actionDispatcher

    fun setAutoOffsetEnabled(enabled: Boolean): Boolean {
        return try {
            if (!enabled) {
                // When disabling auto-offset, save the current applied offset
                // as the manual offset so it persists across restarts
                configManager.overlayOffset = overlayManager.getPositionOffsetY()
                // Reset the calculated flag so it will recalculate if re-enabled
                configManager.autoOffsetCalculated = false
            } else {
                // When enabling, reset the calculated flag to trigger recalculation
                configManager.autoOffsetCalculated = false
            }

            configManager.autoOffsetEnabled = enabled

            // Only recalculate when enabling auto-offset
            if (enabled) {
                mainHandler.post {
                    val autoOffset = overlayManager.calculateAutoOffset()
                    // Save the calculated auto offset back to ConfigManager
                    // so MainActivity can read the correct value
                    configManager.overlayOffset = autoOffset
                    // Mark that auto offset has been calculated
                    configManager.autoOffsetCalculated = true
                    overlayManager.setPositionOffsetY(autoOffset)
                    Log.d(TAG, "Auto offset recalculated: $autoOffset")
                }
            }

            true
        } catch (e: Exception) {
            Log.e(TAG, "Error setting auto offset: ${e.message}", e)
            false
        }
    }

    fun isAutoOffsetEnabled(): Boolean = configManager.autoOffsetEnabled

    fun getVisibleElements(): MutableList<ElementNode> {
        return getVisibleElementsInternal()
    }

    private fun getVisibleElementsInternal(): MutableList<ElementNode> {
        val elements = mutableListOf<ElementNode>()
        val indexCounter = IndexCounter(1)

        val rootNode = rootInActiveWindow ?: return elements
        val rootElement = findAllVisibleElements(rootNode, 0, null, indexCounter)
        rootElement?.let {
            collectRootElements(it, elements)
        }

        synchronized(visibleElements) {
            clearElementList()
            visibleElements.addAll(elements)
        }

        return elements
    }

    private fun collectRootElements(element: ElementNode, rootElements: MutableList<ElementNode>) {
        rootElements.add(element)
    }

    @Suppress("DEPRECATION")
    private fun findAllVisibleElements(
        node: AccessibilityNodeInfo,
        windowLayer: Int,
        parent: ElementNode?,
        indexCounter: IndexCounter
    ): ElementNode? {
        try {

            val rect = Rect()
            node.getBoundsInScreen(rect)

            val isInScreen = Rect.intersects(rect, screenBounds)
            val hasSize = rect.width() > MIN_ELEMENT_SIZE && rect.height() > MIN_ELEMENT_SIZE

            var currentElement: ElementNode? = null

            if (isInScreen && hasSize) {
                val text = node.text?.toString() ?: ""
                val contentDesc = node.contentDescription?.toString() ?: ""
                val className = node.className?.toString() ?: ""
                val viewId = node.viewIdResourceName ?: ""

                val displayText = when {
                    text.isNotEmpty() -> text
                    contentDesc.isNotEmpty() -> contentDesc
                    viewId.isNotEmpty() -> viewId.substringAfterLast('/')
                    else -> className.substringAfterLast('.')
                }

                val elementType = if (node.isClickable) {
                    "Clickable"
                } else if (node.isCheckable) {
                    "Checkable"
                } else if (node.isEditable) {
                    "Input"
                } else if (text.isNotEmpty()) {
                    "Text"
                } else if (node.isScrollable) {
                    "Container"
                } else {
                    "View"
                }

                val id = ElementNode.Companion.createId(rect, className.substringAfterLast('.'), displayText)

                currentElement = ElementNode(
                    AccessibilityNodeInfo(node),
                    Rect(rect),
                    displayText,
                    className.substringAfterLast('.'),
                    windowLayer,
                    System.currentTimeMillis(),
                    id
                )

                // Assign unique index
                currentElement.overlayIndex = indexCounter.getNext()

                // Set parent-child relationship
                parent?.addChild(currentElement)
            }

            // Recursively process children
            for (i in 0 until node.childCount) {
                val childNode = node.getChild(i) ?: continue
                findAllVisibleElements(childNode, windowLayer, currentElement, indexCounter)
            }

            return currentElement

        } catch (e: Exception) {
            Log.e(TAG, "Error in findAllVisibleElements: ${e.message}", e)
            return null
        }
    }

    fun getPhoneState(): PhoneState {
        val focusedNode = findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: findFocus(
            AccessibilityNodeInfo.FOCUS_ACCESSIBILITY
        )
        val isEditable = focusedNode?.isEditable ?: false
        val keyboardVisible = detectKeyboardVisibility()
        val currentPackage = rootInActiveWindow?.packageName?.toString()
        val appName = getAppName(currentPackage)

        return PhoneState(
            focusedNode,
            keyboardVisible,
            currentPackage,
            appName,
            isEditable,
            currentActivityName,
        )
    }

    private fun detectKeyboardVisibility(): Boolean {
        try {
            val windows = windows
            if (windows != null) {
                val hasInputMethodWindow =
                    windows.any { window -> window.type == AccessibilityWindowInfo.TYPE_INPUT_METHOD }
                windows.forEach { it.recycle() }
                return hasInputMethodWindow
            } else {
                return false
            }
        } catch (e: Exception) {
            return false
        }
    }

    private fun getAppName(packageName: String?): String? {
        return try {
            if (packageName == null) return null

            val packageManager = packageManager
            val applicationInfo = packageManager.getApplicationInfo(packageName, 0)
            packageManager.getApplicationLabel(applicationInfo).toString()
        } catch (e: Exception) {
            Log.e(TAG, "Error getting app name for package $packageName: ${e.message}")
            null
        }
    }

    // Helper class to maintain global index counter
    private class IndexCounter(private var current: Int = 1) {
        fun getNext(): Int = current++
    }

    @Suppress("DEPRECATION")
    fun getDeviceContext(): JSONObject {
        return JSONObject().apply {
            // Screen dimensions
            put("screen_bounds", JSONObject().apply {
                put("width", screenBounds.width())
                put("height", screenBounds.height())
            })

            // Filtering parameters
            put("filtering_params", JSONObject().apply {
                put("min_element_size", MIN_ELEMENT_SIZE)
                put("overlay_offset", getOverlayOffset())
            })

            // Display metrics
            val metrics = resources.displayMetrics
            put("display_metrics", JSONObject().apply {
                put("density", metrics.density)
                put("densityDpi", metrics.densityDpi)
                put("scaledDensity", metrics.scaledDensity)
                put("widthPixels", metrics.widthPixels)
                put("heightPixels", metrics.heightPixels)
            })
        }
    }

    @Suppress("DEPRECATION")
    fun inputText(text: String, clear: Boolean): Boolean {
        val root = rootInActiveWindow ?: return false

        // Strategy 1: Find focused input directly
        var targetNode = findFocus(AccessibilityNodeInfo.FOCUS_INPUT)

        // Strategy 2: If no focus, try to find editable node in the tree
        if (targetNode == null || !targetNode.isEditable) {
            // Simple DFS search for first editable node
            // Use a helper function
            targetNode = findEditableNode(root)
        }

        if (targetNode == null) return false

        try {
            // Logic to support both Replace (clear=true) and Append (clear=false).

            // Delegate logic to pure function for testability
            val currentText = targetNode.text?.toString()
            val hintText = targetNode.hintText?.toString()
            val finalText = calculateInputText(currentText, hintText, text, clear)

            // Note: ACTION_SET_TEXT always replaces existing content with the argument.
            // So for clear=true, we just set 'text'.
            // For clear=false, we set 'oldText + text'.

            val arguments = android.os.Bundle()
            arguments.putCharSequence(
                AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                finalText
            )
            return targetNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
        } catch (e: Exception) {
            Log.e(TAG, "Error setting text via accessibility: ${e.message}")
            return false
        } finally {
            // Don't recycle targetNode if it's root (unlikely for focus) but standard practice
            // findFocus returns a node that MUST be recycled.
            // rootInActiveWindow returns a node that MUST be recycled.
            // We should handle recycling carefully.
            try {
                if (targetNode != root) targetNode.recycle()
                root.recycle()
            } catch (e: Exception) {
            }
        }
    }

    private fun findEditableNode(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        // Check if node is editable
        if (node.isEditable) return node

        // Also check if it's an EditText (common input field class)
        val className = node.className?.toString() ?: ""
        if (className.contains("EditText", ignoreCase = true) ||
            className.contains("TextInput", ignoreCase = true)) {
            return node
        }

        // Check if it supports ACTION_SET_TEXT (indicates it's a text field)
        if (node.actionList.any { it.id == AccessibilityNodeInfo.ACTION_SET_TEXT }) {
            // Additional validation: check if it's focusable or clickable (real input field)
            if (node.isFocusable || node.isClickable) {
                return node
            }
        }

        // Recursively search children
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val found = findEditableNode(child)
            if (found != null) {
                return found
            }
        }
        return null
    }

    override fun onOverlayVisibilityChanged(visible: Boolean) {
        // Already handled in setOverlayVisible method
    }

    override fun onOverlayOffsetChanged(offset: Int) {
        // Already handled in setOverlayOffset method
    }

    override fun onWebSocketEnabledChanged(enabled: Boolean) {
        // No action needed - using BackendWebSocketService instead
    }

    override fun onWebSocketPortChanged(port: Int) {
        // No action needed - using BackendWebSocketService instead
    }

    // Screenshot functionality - delegated to ScreenshotManager
    fun takeScreenshotBase64(hideOverlay: Boolean = true): CompletableFuture<String> {
        return screenshotManager.takeScreenshotBase64(hideOverlay)
    }

    /**
     * Automatically start FloatingButtonService when accessibility service is enabled
     * Only starts if:
     * - Overlay permission is granted
     * - User has not previously dismissed the floating button
     */
    private fun startFloatingButtonIfNeeded() {
        try {
            // Check if overlay permission is granted
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (!Settings.canDrawOverlays(this)) {
                    Log.d(TAG, "Overlay permission not granted, skipping floating button auto-start")
                    return
                }
            }

            // Check if user previously dismissed the floating button
            if (configManager.floatingButtonDismissed) {
                Log.d(TAG, "Floating button was dismissed by user, not auto-starting")
                return
            }

            // Start FloatingButtonService
            val intent = Intent(this, FloatingButtonService::class.java)
            startService(intent)
            Log.d(TAG, "Floating button service auto-started")
        } catch (e: Exception) {
            Log.e(TAG, "Error auto-starting floating button service: ${e.message}", e)
        }
    }

    override fun onInterrupt() {
        Log.d(TAG, "Accessibility service interrupted")
        periodicUpdateController.stopPeriodicUpdates()
    }

    override fun onDestroy() {
        super.onDestroy()
        periodicUpdateController.stopPeriodicUpdates()

        // Release sound resources
        toneGenerator?.release()
        toneGenerator = null

        clearElementList()
        configManager.removeListener(this)
        instance = null
        Log.d(TAG, "Accessibility service destroyed")
    }
}
