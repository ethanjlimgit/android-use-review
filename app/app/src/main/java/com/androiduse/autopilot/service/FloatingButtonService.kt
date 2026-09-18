package com.androiduse.autopilot.service

import android.app.AlertDialog
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.provider.Settings
import android.util.Log
import android.view.WindowManager
import android.widget.Toast
import com.androiduse.autopilot.api.ApiHandler
import com.androiduse.autopilot.api.PackageCache
import com.androiduse.autopilot.auth.api.RetrofitClient
import com.androiduse.autopilot.model.Task
import com.androiduse.autopilot.client.BackendWebSocketClient
import com.androiduse.autopilot.core.StateRepository
import com.androiduse.autopilot.input.AndroidUseKeyboardIME
import com.androiduse.autopilot.paywall.StripePaymentActivity
import com.androiduse.autopilot.ui.AccessibilityPermissionActivity
import com.androiduse.autopilot.ui.TaskStateManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

/**
 * Refactored FloatingButtonService - coordinates between extracted components
 *
 * Responsibilities:
 * - Service lifecycle management
 * - Component initialization and coordination
 * - Provides external interface for other services
 */
class FloatingButtonService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // Managers/Controllers
    private lateinit var uiController: FloatingButtonUIController
    private lateinit var speechManager: SpeechRecognitionManager
    private lateinit var gestureHandler: FloatingButtonGestureHandler
    private lateinit var taskExecutor: FloatingButtonTaskExecutor

    // Dependencies
    private var windowManager: WindowManager? = null
    private var ttsManager: TTSManager? = null
    private var packageCache: PackageCache? = null
    private var apiHandler: ApiHandler? = null

    companion object {
        private const val TAG = "FloatingButtonService"
        const val EXTRA_FROM_ASSISTANT = "from_assistant"

        @Volatile
        private var instance: FloatingButtonService? = null

        fun getInstance(): FloatingButtonService? = instance
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        Log.d(TAG, "FloatingButtonService created")

        // Check overlay permission before initializing
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            if (!android.provider.Settings.canDrawOverlays(this)) {
                Log.e(TAG, "Overlay permission not granted. FloatingButtonService cannot start.")
                android.widget.Toast.makeText(
                    this,
                    "Please grant 'Display over other apps' permission in Settings",
                    android.widget.Toast.LENGTH_LONG
                ).show()
                stopSelf()
                return
            }
        }

        // Initialize dependencies
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        ttsManager = TTSManager.getInstance(this)
        packageCache = PackageCache.getInstance(this)

        // Ensure BackendWebSocketService is started
        BackendServiceInitializer.ensureServiceStarted(this)

        initializeApiHandler()
        initializeComponents()
        setupCallbacks()
        observeTaskState()
        observeConnectionStatus()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "FloatingButtonService started")

        // Check if triggered from assistant
        val fromAssistant = intent?.getBooleanExtra(EXTRA_FROM_ASSISTANT, false) ?: false
        if (fromAssistant) {
            Log.d(TAG, "Service started from digital assistant - showing overlay")
            // Show overlay when triggered from assistant
            showOverlay()
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    /**
     * Initialize ApiHandler
     */
    private fun initializeApiHandler() {
        val accessibilityService = AndroidUseAccessibilityService.getInstance()
        if (accessibilityService == null) {
            Log.w(TAG, "AndroidUseAccessibilityService not available, ApiHandler initialization deferred")
            return
        }

        try {
            val stateRepo = StateRepository(accessibilityService)
            apiHandler = ApiHandler(
                stateRepo = stateRepo,
                getKeyboardIME = { AndroidUseKeyboardIME.getInstance() },
                getPackageManager = { packageManager },
                appVersionProvider = {
                    try {
                        packageManager.getPackageInfo(packageName, 0).versionName ?: "unknown"
                    } catch (e: Exception) {
                        "unknown"
                    }
                },
                context = this
            )
            Log.d(TAG, "ApiHandler initialized successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing ApiHandler: ${e.message}", e)
        }
    }

    /**
     * Initialize all components
     */
    private fun initializeComponents() {
        val wm = windowManager ?: return

        // Initialize UI Controller
        uiController = FloatingButtonUIController(this, wm)
        uiController.createFloatingButton()

        // Initialize Speech Manager
        speechManager = SpeechRecognitionManager(this, serviceScope)
        speechManager.initialize()
        speechManager.setPartialResultsView(uiController.partialSpeechText)

        // Initialize Gesture Handler
        gestureHandler = FloatingButtonGestureHandler(this, wm)
        gestureHandler.createTrashZone()
        gestureHandler.setupDragListeners(
            touchTargetView = uiController.simpleFloatingButton,
            containerView = uiController.floatingButtonView,
            buttonParams = uiController.buttonParams
        )

        // Initialize Task Executor
        taskExecutor = FloatingButtonTaskExecutor(this, serviceScope)

        Log.d(TAG, "All components initialized")
    }

    /**
     * Setup callbacks between components
     */
    private fun setupCallbacks() {
        // UI Controller callbacks
        uiController.onFloatingButtonClicked = {
            handleFloatingButtonClick()
        }

        uiController.onOverlayBackgroundClicked = {
            uiController.hideOverlay()
        }

        uiController.onSettingsButtonClicked = {
            // Hide overlay and show floating button
            uiController.hideOverlay()

            // Open MainActivity
            uiController.openMainActivity()
        }

        uiController.onMicButtonClicked = {
            handleMicButtonClick()
        }

        uiController.onSendButtonClicked = { instruction ->
            submitTask(instruction)
        }

        uiController.onSuggestionClicked = { command ->
            submitTask(command)
        }

        uiController.onSuggestionCopied = { command ->
            // Copy the command to the input box without executing
            uiController.setInputText(command)
        }

        // Speech Manager callbacks
        speechManager.onSpeechStarted = {
            uiController.updateMicButtonState(true)
        }

        speechManager.onSpeechEnded = {
            uiController.updateMicButtonState(false)
        }

        speechManager.onResults = { transcribedText ->
            uiController.instructionInput?.setText(transcribedText)
            submitTask(transcribedText)
        }

        speechManager.onError = { errorMsg ->
            uiController.updateMicButtonState(false)
            uiController.showStatusWithAutoHide(errorMsg)
        }

        // Gesture Handler callbacks
        gestureHandler.onButtonClicked = {
            handleFloatingButtonClick()
        }

        gestureHandler.onButtonDismissed = {
            dismissFloatingButton()
        }

        // Task Executor callbacks
        taskExecutor.onExecutionStarted = {
            // Show edge glow animation
            uiController.showEdgeGlow()
        }

        taskExecutor.onExecutionEnded = {
            // Hide edge glow animation
            uiController.hideEdgeGlow()
        }

        taskExecutor.onTaskLimitReached = {
            showTaskLimitDialog()
        }
    }

    /**
     * Handle floating button click
     * If task is running, stop it. Otherwise, show overlay.
     */
    private fun handleFloatingButtonClick() {
        // Check if a task is currently executing using both TaskStateManager and local executor state
        val globalIsExecuting = TaskStateManager.isTaskExecuting()
        val localIsExecuting = taskExecutor.isCurrentlyExecuting()
        val taskId = TaskStateManager.getCurrentTaskId()
        val pendingTaskId = taskExecutor.getPendingTaskId()

        Log.d(TAG, "Floating button clicked - globalIsExecuting: $globalIsExecuting, localIsExecuting: $localIsExecuting, taskId: $taskId, pendingTaskId: $pendingTaskId")

        // Consider task as executing if either global or local state says so
        val isExecuting = globalIsExecuting || localIsExecuting

        if (isExecuting) {
            // Use taskId if available, fallback to pendingTaskId
            val effectiveTaskId = taskId ?: pendingTaskId
            if (effectiveTaskId != null) {
                Log.d(TAG, "Task is running - stopping task: $effectiveTaskId")
                stopRunningTask(effectiveTaskId)
            } else {
                Log.w(TAG, "Task is executing but no task ID found - forcing stop")
                // Force stop all execution state
                TaskStateManager.stopTask()
                taskExecutor.stopExecution()
                uiController.hideEdgeGlow()
                showOverlay()
            }
        } else {
            Log.d(TAG, "No task running - showing overlay")
            showOverlay()
        }
    }

    /**
     * Show the floating button overlay
     */
    private fun showOverlay() {
        Log.d(TAG, "Floating button clicked - checking backend connection")
        ensureBackendConnected()
        preloadAppsCache()

        // Try to initialize ApiHandler if not already done (handles timing issue where
        // FloatingButtonService starts before accessibility service is ready)
        if (apiHandler == null) {
            initializeApiHandler()
        }

        // Capture device state BEFORE showing overlay (so we get the actual app state, not the overlay)
        // This may be null if accessibility service is not enabled
        val capturedState = captureDeviceStateForSuggestions()

        // Now show the overlay
        uiController.showOverlay()

        // Request task suggestions only if we have device state
        // (backend requires state_full for suggestions)
        if (capturedState != null) {
            requestTaskSuggestions(capturedState)
        } else {
            Log.w(TAG, "No device state available, skipping suggestions request")
        }
    }

    /**
     * Capture device state for suggestions before showing overlay
     * @return The full device state JSON, or null if capture failed
     */
    private fun captureDeviceStateForSuggestions(): org.json.JSONObject? {
        val handler = apiHandler
        if (handler == null) {
            Log.w(TAG, "ApiHandler not available for capturing state")
            return null
        }

        return try {
            val stateResponse = handler.getStateFull(filter = true)
            when (stateResponse) {
                is com.androiduse.autopilot.api.ApiResponse.RawObject -> stateResponse.json
                else -> {
                    Log.w(TAG, "Failed to capture device state: $stateResponse")
                    null
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error capturing device state: ${e.message}", e)
            null
        }
    }

    /**
     * Request task suggestions from the backend based on captured device state
     * @param stateFull The pre-captured device state (can be null if accessibility not enabled)
     */
    private fun requestTaskSuggestions(stateFull: org.json.JSONObject?) {
        serviceScope.launch {
            try {
                val backendService = BackendWebSocketService.getInstance()
                if (backendService == null) {
                    Log.w(TAG, "BackendWebSocketService not available for suggestions")
                    uiController.hideSuggestions()
                    return@launch
                }

                // Set up callback for receiving suggestions
                backendService.setTaskSuggestionsCallback { response ->
                    handleTaskSuggestionsResponse(response)
                }

                // Show loading state
                uiController.showSuggestionsLoading()

                // Request suggestions using the pre-captured state (without screenshot for faster response)
                // If stateFull is null (accessibility not enabled), still request suggestions
                val requestId = backendService.requestTaskSuggestions(
                    stateFull = stateFull,
                    screenshotBase64 = null, // Skip screenshot for speed
                    maxSuggestions = 5
                )

                if (requestId == null) {
                    Log.w(TAG, "Failed to send suggestions request")
                    uiController.hideSuggestions()
                }

                Log.d(TAG, "Task suggestions requested: $requestId (with state: ${stateFull != null})")
            } catch (e: Exception) {
                Log.e(TAG, "Error requesting suggestions: ${e.message}", e)
                uiController.hideSuggestions()
            }
        }
    }

    /**
     * Handle task suggestions response from backend
     */
    private fun handleTaskSuggestionsResponse(response: BackendWebSocketClient.TaskSuggestionsResponse) {
        Log.d(TAG, "Received suggestions response: success=${response.success}, count=${response.suggestions.size}")

        if (!response.success || response.suggestions.isEmpty()) {
            uiController.hideSuggestions()
            return
        }

        // Convert suggestions to SuggestionData objects with title, description, and command
        val suggestionDataList = response.suggestions.map { suggestion ->
            FloatingButtonUIController.SuggestionData(
                title = suggestion.title,
                description = suggestion.description,
                command = suggestion.command
            )
        }

        uiController.showSuggestions(suggestionDataList)
    }

    /**
     * Stop a running task
     */
    private fun stopRunningTask(taskId: String) {
        Log.d(TAG, "stopRunningTask called for task: $taskId")

        // Immediately update UI state (don't wait for backend)
        TaskStateManager.stopTask()
        taskExecutor.stopExecution()
        uiController.hideEdgeGlow()
        stopExecutionAnimation()

        serviceScope.launch {
            try {
                val backendService = BackendWebSocketService.getInstance()
                if (backendService == null) {
                    Log.w(TAG, "BackendWebSocketService not available - task stopped locally only")
                    Toast.makeText(
                        this@FloatingButtonService,
                        "Task stopped",
                        Toast.LENGTH_SHORT
                    ).show()
                    return@launch
                }

                // Send stop task request to backend
                backendService.stopTask(taskId)
                Log.d(TAG, "Stop task request sent for task: $taskId")

                // Show confirmation
                Toast.makeText(
                    this@FloatingButtonService,
                    "Task stopped",
                    Toast.LENGTH_SHORT
                ).show()
            } catch (e: Exception) {
                Log.e(TAG, "Error sending stop task to backend: ${e.message}", e)
                // Task is already stopped locally, just log the error
                Toast.makeText(
                    this@FloatingButtonService,
                    "Task stopped",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    /**
     * Handle microphone button click
     */
    private fun handleMicButtonClick() {
        if (speechManager.isCurrentlyListening()) {
            speechManager.stopListening()
            uiController.updateMicButtonState(false)
            return
        }

        // Check permission - if not granted, show explanation and request
        if (!speechManager.hasAudioPermission()) {
            // Show toast explaining why permission is needed
            Toast.makeText(
                this,
                "Microphone permission is required for voice input. Please enable it in Settings > Apps > AndroidUse > Permissions",
                Toast.LENGTH_LONG
            ).show()

            // Note: We cannot request permissions from a Service
            // User must grant permission manually in Settings
            Log.w(TAG, "Microphone permission not granted. User must enable it in Settings.")
            return
        }

        speechManager.startListening()
        Toast.makeText(this, "Listening...", Toast.LENGTH_SHORT).show()
    }

    /**
     * Submit task to backend
     */
    private fun submitTask(instruction: String) {
        if (instruction.isBlank()) {
            Toast.makeText(this, "Please enter a task", Toast.LENGTH_SHORT).show()
            return
        }

        // Check accessibility permission before submitting
        if (!isAccessibilityServiceEnabled()) {
            Log.w(TAG, "Accessibility service not enabled, prompting user")
            showAccessibilityPermissionRequest()
            return
        }

        // Ensure backend is connected before submitting
        Log.d(TAG, "Submitting task - checking backend connection")
        ensureBackendConnected()

        // Check backend connection status
        val backendService = BackendWebSocketService.getInstance()
        if (backendService == null) {
            Toast.makeText(this, "Backend not connected", Toast.LENGTH_SHORT).show()
            Log.w(TAG, "Backend service not available")
            return
        }

        val status = backendService.getConnectionStatus()
        if (status != "Connected") {
            Log.w(TAG, "Backend not connected (status: $status), attempting to reconnect")
            Toast.makeText(this, "Connecting to backend...", Toast.LENGTH_SHORT).show()
            BackendServiceInitializer.ensureConnected()
        }

        // Hide overlay
        uiController.hideOverlay()

        // Submit task
        taskExecutor.submitTask(
            instruction = instruction,
            onSuccess = { taskId ->
                Log.d(TAG, "Task submitted: $taskId")
                ttsManager?.speak(instruction)
            },
            onError = { error ->
                Toast.makeText(this, error, Toast.LENGTH_SHORT).show()
            }
        )
    }

    /**
     * Check if accessibility service is enabled
     */
    private fun isAccessibilityServiceEnabled(): Boolean {
        val serviceName = "$packageName/${AndroidUseAccessibilityService::class.java.canonicalName}"
        val enabledServices = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        )
        return enabledServices?.contains(serviceName) == true
    }

    /**
     * Show accessibility permission request - launches an activity since dialogs can't be shown from a service
     */
    private fun showAccessibilityPermissionRequest() {
        try {
            val intent = Intent(this, AccessibilityPermissionActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error showing accessibility permission request: ${e.message}", e)
            // Fallback to toast with settings navigation
            Toast.makeText(
                this,
                "Please enable PhoneGPT accessibility service in Settings",
                Toast.LENGTH_LONG
            ).show()
            openAccessibilitySettings()
        }
    }

    /**
     * Open accessibility settings
     */
    private fun openAccessibilitySettings() {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error opening accessibility settings: ${e.message}", e)
        }
    }

    /**
     * Observe global task state for animation
     */
    private fun observeTaskState() {
        serviceScope.launch {
            TaskStateManager.taskState.collectLatest { state ->
                if (state.isExecuting) {
                    startExecutionAnimation()
                } else {
                    stopExecutionAnimation()
                }
            }
        }
    }

    /**
     * Observe backend connection status and update UI indicator
     */
    private fun observeConnectionStatus() {
        serviceScope.launch {
            while (true) {
                try {
                    val backendService = BackendWebSocketService.getInstance()
                    val isConnected = backendService?.getConnectionStatus() == "Connected"
                    uiController.updateConnectionStatus(isConnected)
                } catch (e: Exception) {
                    Log.e(TAG, "Error checking connection status: ${e.message}")
                    uiController.updateConnectionStatus(false)
                }
                // Check every 2 seconds
                kotlinx.coroutines.delay(2000)
            }
        }
    }

    /**
     * Show task limit dialog
     */
    private fun showTaskLimitDialog() {
        try {
            val intent = android.content.Intent(this, StripePaymentActivity::class.java).apply {
                flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
                putExtra("source", "floating_button")
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error showing paywall: ${e.message}", e)
            Toast.makeText(this, "Task limit reached", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Dismiss the floating button
     */
    private fun dismissFloatingButton() {
        try {
            stopSelf()
            Log.d(TAG, "Floating button dismissed")
        } catch (e: Exception) {
            Log.e(TAG, "Error dismissing button: ${e.message}", e)
        }
    }

    /**
     * Ensure backend WebSocket is connected
     * If not connected, attempt to reconnect
     */
    private fun ensureBackendConnected() {
        serviceScope.launch {
            try {
                val backendService = BackendWebSocketService.getInstance()
                if (backendService == null) {
                    Log.w(TAG, "BackendWebSocketService not available, attempting to start")
                    BackendServiceInitializer.ensureServiceStarted(this@FloatingButtonService)
                    return@launch
                }

                val status = backendService.getConnectionStatus()
                if (status != "Connected") {
                    Log.d(TAG, "Backend not connected (status: $status), attempting to reconnect")
                    BackendServiceInitializer.ensureConnected()
                } else {
                    Log.d(TAG, "Backend already connected")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error ensuring backend connection: ${e.message}", e)
            }
        }
    }

    /**
     * Preload apps cache in background
     * This ensures the cache is ready when backend requests app list
     */
    private fun preloadAppsCache() {
        serviceScope.launch {
            try {
                Log.d(TAG, "Preloading apps cache...")
                apiHandler?.preloadAppsCache()
            } catch (e: Exception) {
                Log.e(TAG, "Error preloading apps cache: ${e.message}", e)
            }
        }
    }

    // ==================== External Interface ====================

    /**
     * Start execution animation - called by BackendWebSocketService
     */
    fun startExecutionAnimation() {
        taskExecutor.startExecutionAnimation(uiController.simpleFloatingButton)
    }

    /**
     * Stop execution animation - called by BackendWebSocketService
     */
    fun stopExecutionAnimation() {
        taskExecutor.stopExecutionAnimation(uiController.simpleFloatingButton)
    }

    /**
     * Handle task result - called by BackendWebSocketService
     */
    fun handleTaskResult(result: BackendWebSocketClient.TaskResult) {
        taskExecutor.handleTaskResult(result)

        // Show result in UI
        val message = if (result.success) {
            "✓ ${result.reason}"
        } else {
            "✗ ${result.reason}"
        }
        uiController.showStatusWithAutoHide(message)

        // Speak result if TTS enabled
        ttsManager?.speak(result.reason)

        Log.d(TAG, "Task result handled: ${result.taskId}")
    }

    // ==================== Lifecycle ====================

    override fun onDestroy() {
        super.onDestroy()

        // Cleanup components
        uiController.destroy()
        speechManager.destroy()
        gestureHandler.destroy()

        instance = null
        Log.d(TAG, "FloatingButtonService destroyed")
    }
}
