package com.androiduse.autopilot.service

import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.IBinder
import android.speech.tts.TextToSpeech
import android.util.Log
import com.androiduse.autopilot.analytics.AnalyticsManager
import com.androiduse.autopilot.api.ApiHandler
import com.androiduse.autopilot.auth.SessionManager
import com.androiduse.autopilot.auth.api.RefreshTokenRequest
import com.androiduse.autopilot.auth.api.RetrofitClient
import com.androiduse.autopilot.client.BackendWebSocketClient
import com.androiduse.autopilot.config.ConfigManager
import com.androiduse.autopilot.core.StateRepository
import com.androiduse.autopilot.paywall.SubscriptionManager
import com.androiduse.autopilot.input.AndroidUseKeyboardIME
import com.androiduse.autopilot.transcription.TranscriptionManager
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.URI
import java.nio.ByteBuffer
import java.util.Locale

/**
 * Android Service managing WebSocket client connection to backend server
 * Handles task submission and reconnection logic
 */
class BackendWebSocketService : Service(), ConfigManager.ConfigChangeListener {

    companion object {
        private const val TAG = "BackendWSService"
        private const val RECONNECT_DELAY_MS = 5000L
        private const val MAX_RECONNECT_DELAY_MS = 60000L

        @Volatile
        private var instance: BackendWebSocketService? = null

        fun getInstance(): BackendWebSocketService? = instance
    }

    private var wsClient: BackendWebSocketClient? = null
    private var reconnectJob: Job? = null
    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private lateinit var configManager: ConfigManager
    private lateinit var sessionManager: SessionManager
    private var actionDispatcher: ActionDispatcher? = null
    private var reconnectAttempts = 0
    private var currentStatus = BackendWebSocketClient.ConnectionStatus.DISCONNECTED
    private val connectionLock = Any()
    private var authFailedLogout = false

    // Voice command mode
    private var transcriptionManager: TranscriptionManager? = null
    private var textToSpeech: TextToSpeech? = null
    private var ttsReady = false
    private var activeVoiceTaskId: String? = null

    // Task suggestions callback
    private var onTaskSuggestionsReceived: ((BackendWebSocketClient.TaskSuggestionsResponse) -> Unit)? = null

    // Auto-reply callback
    private var onAutoReplyReceived: ((BackendWebSocketClient.AutoReplyResponse) -> Unit)? = null

    inner class LocalBinder : Binder() {
        fun getService(): BackendWebSocketService = this@BackendWebSocketService
    }

    private val binder = LocalBinder()

    override fun onBind(intent: Intent?): IBinder {
        return binder
    }

    override fun onCreate() {
        super.onCreate()
        instance = this

        configManager = ConfigManager.Companion.getInstance(this)
        configManager.addListener(this)

        sessionManager = SessionManager(this)

        // Initialize TranscriptionManager
        transcriptionManager = TranscriptionManager(this, serviceScope)

        // Initialize TextToSpeech
        textToSpeech = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val result = textToSpeech?.setLanguage(Locale.US)
                ttsReady = result != TextToSpeech.LANG_MISSING_DATA &&
                        result != TextToSpeech.LANG_NOT_SUPPORTED
                Log.d(TAG, "TextToSpeech initialized: ready=$ttsReady")
            } else {
                Log.e(TAG, "TextToSpeech initialization failed")
                ttsReady = false
            }
        }

        Log.d(TAG, "BackendWebSocketService created")

        // Connect if enabled
        if (configManager.backendWsEnabled && configManager.backendWsHost.isNotEmpty()) {
            connect()
        }
    }

    override fun onBackendWsEnabledChanged(enabled: Boolean) {
        Log.d(TAG, "Backend WebSocket enabled changed: $enabled")
        if (enabled) {
            connect()
        } else {
            disconnect()
        }
    }

    override fun onBackendWsHostChanged(host: String) {
        Log.d(TAG, "Backend WebSocket host changed: $host")
        // Reconnect with new host
        disconnect()
        if (configManager.backendWsEnabled && host.isNotEmpty()) {
            serviceScope.launch {
                delay(1000) // Brief delay before reconnecting
                connect()
            }
        }
    }

    override fun onOverlayVisibilityChanged(visible: Boolean) {}
    override fun onOverlayOffsetChanged(offset: Int) {}

    /**
     * Connect to backend WebSocket server
     * Ensures only one active connection exists at a time
     */
    private fun connect() {
        synchronized(connectionLock) {
            // Check if already connected or connecting
            if (wsClient?.isOpen == true) {
                Log.d(TAG, "Already connected")
                return
            }

            // Prevent duplicate connection attempts while connecting
            if (currentStatus == BackendWebSocketClient.ConnectionStatus.CONNECTING && wsClient != null) {
                Log.d(TAG, "Connection already in progress")
                return
            }

            // Close any existing client before creating a new one
            wsClient?.let { existingClient ->
                Log.d(TAG, "Closing existing WebSocket client before reconnect")
                try {
                    existingClient.closeConnection()
                } catch (e: Exception) {
                    Log.w(TAG, "Error closing existing client: ${e.message}")
                }
                wsClient = null
            }

            val host = configManager.backendWsHost
            val port = configManager.backendWsPort

            if (host.isEmpty()) {
                Log.w(TAG, "Cannot connect: host is empty")
                updateConnectionStatus(BackendWebSocketClient.ConnectionStatus.ERROR)
                return
            }

            val authToken = sessionManager.getAccessToken() ?: ""
            val deviceId = configManager.deviceId
            if (authToken.isEmpty() || deviceId.isEmpty()) {
                Log.w(TAG, "Cannot connect: authToken=${if (authToken.isEmpty()) "EMPTY" else "present(${authToken.length}chars)"}, " +
                    "deviceId=${if (deviceId.isEmpty()) "EMPTY" else "present"}, " +
                    "isAuthenticated=${sessionManager.isAuthenticated()}, isTokenExpired=${sessionManager.isTokenExpired()}")
                Log.w(TAG, "Triggering logout due to missing auth credentials")
                authFailedLogout = true
                handleUnauthorized()
                return
            }

            // Initialize ActionDispatcher if needed
            if (actionDispatcher == null) {
                initializeActionDispatcher()
            }

            if (actionDispatcher == null) {
                Log.e(TAG, "Cannot connect: ActionDispatcher initialization failed")
                updateConnectionStatus(BackendWebSocketClient.ConnectionStatus.ERROR)
                return
            }

            try {
                // Use wss:// for port 443 (staging/production), ws:// otherwise (dev)
                val protocol = if (port == 443) "wss" else "ws"
                val serverUri = URI("$protocol://$host:$port")
                Log.d(TAG, "Connecting to $serverUri")

                updateConnectionStatus(BackendWebSocketClient.ConnectionStatus.CONNECTING)

                wsClient = BackendWebSocketClient(
                    serverUri = serverUri,
                    actionDispatcher = actionDispatcher!!,
                    authToken = authToken,
                    deviceId = deviceId,
                    onResultReceived = { result ->
                        handleTaskResult(result)
                    },
                    onConnectionStatusChanged = { status ->
                        handleConnectionStatusChanged(status)
                    },
                    onUnauthorized = {
                        handleUnauthorized()
                    },
                    onTranscriptionMessage = { json ->
                        handleTranscriptionMessage(json)
                    },
                    onAgentResponse = { taskId, text, responseType ->
                        handleAgentResponse(taskId, text, responseType)
                    },
                    onTaskSuggestionsReceived = { response ->
                        handleTaskSuggestionsResponse(response)
                    },
                    onAutoReplyResponse = { response ->
                        handleAutoReplyResponse(response)
                    }
                )

                wsClient?.connect()
            } catch (e: Exception) {
                Log.e(TAG, "Error creating WebSocket client: ${e.message}", e)
                updateConnectionStatus(BackendWebSocketClient.ConnectionStatus.ERROR)
                startReconnectionLoop()
            }
        }
    }

    /**
     * Disconnect from backend server
     */
    private fun disconnect() {
        synchronized(connectionLock) {
            Log.d(TAG, "Disconnecting")
            reconnectJob?.cancel()
            reconnectJob = null
            reconnectAttempts = 0

            wsClient?.closeConnection()
            wsClient = null

            updateConnectionStatus(BackendWebSocketClient.ConnectionStatus.DISCONNECTED)
        }
    }

    /**
     * Initialize ActionDispatcher using AndroidUseAccessibilityService
     */
    private fun initializeActionDispatcher() {
        val accessibilityService = AndroidUseAccessibilityService.getInstance()
        if (accessibilityService == null) {
            Log.e(TAG, "AndroidUseAccessibilityService not available")
            return
        }

        try {
            val stateRepo = StateRepository(accessibilityService)
            val apiHandler = ApiHandler(
                stateRepo = stateRepo,
                getKeyboardIME = { AndroidUseKeyboardIME.Companion.getInstance() },
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

            actionDispatcher = ActionDispatcher(apiHandler)
            Log.d(TAG, "ActionDispatcher initialized successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing ActionDispatcher: ${e.message}", e)
        }
    }

    /**
     * Handle connection status changes
     */
    private fun handleConnectionStatusChanged(status: BackendWebSocketClient.ConnectionStatus) {
        updateConnectionStatus(status)

        when (status) {
            BackendWebSocketClient.ConnectionStatus.CONNECTED -> {
                Log.d(TAG, "Connected to backend server")
                reconnectAttempts = 0
                reconnectJob?.cancel()
                reconnectJob = null
            }
            BackendWebSocketClient.ConnectionStatus.DISCONNECTED,
            BackendWebSocketClient.ConnectionStatus.ERROR -> {
                if (authFailedLogout) {
                    Log.w(TAG, "Connection lost due to auth failure - not reconnecting")
                    return
                }
                Log.w(TAG, "Connection lost, will attempt reconnection")
                if (configManager.backendWsEnabled && configManager.backendWsHost.isNotEmpty()) {
                    startReconnectionLoop()
                }
            }
            else -> {}
        }
    }

    /**
     * Start reconnection loop with exponential backoff
     */
    private fun startReconnectionLoop() {
        if (reconnectJob?.isActive == true) {
            Log.d(TAG, "Reconnection loop already running")
            return
        }

        reconnectJob?.cancel()
        reconnectJob = serviceScope.launch {
            while (isActive && configManager.backendWsEnabled && configManager.backendWsHost.isNotEmpty()) {
                val delay = calculateReconnectDelay()
                Log.d(TAG, "Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts + 1})")

                updateConnectionStatus(
                    BackendWebSocketClient.ConnectionStatus.DISCONNECTED,
                    "Reconnecting in ${delay / 1000}s"
                )

                delay(delay)

                if (!isActive) break

                reconnectAttempts++
                connect()

                // Wait to see if connection succeeds
                delay(3000)

                // If connected, break the loop
                if (wsClient?.isOpen == true) {
                    break
                }
            }
        }
    }

    /**
     * Calculate reconnection delay with exponential backoff
     */
    private fun calculateReconnectDelay(): Long {
        val delay = RECONNECT_DELAY_MS * (1 shl reconnectAttempts.coerceAtMost(6))
        return delay.coerceAtMost(MAX_RECONNECT_DELAY_MS)
    }

    /**
     * Update connection status and notify ConfigManager listeners
     */
    private fun updateConnectionStatus(
        status: BackendWebSocketClient.ConnectionStatus,
        customMessage: String? = null
    ) {
        currentStatus = status

        val statusText = customMessage ?: when (status) {
            BackendWebSocketClient.ConnectionStatus.CONNECTED -> "Connected"
            BackendWebSocketClient.ConnectionStatus.CONNECTING -> "Connecting"
            BackendWebSocketClient.ConnectionStatus.DISCONNECTED -> "Disconnected"
            BackendWebSocketClient.ConnectionStatus.ERROR -> "Error"
        }

        configManager.notifyBackendWsConnectionStatus(statusText)
    }

    /**
     * Handle unauthorized/authentication error.
     * Attempts to refresh the token first; only clears the session if refresh fails.
     */
    private fun handleUnauthorized() {
        Log.w(TAG, "Unauthorized error detected - attempting token refresh")

        serviceScope.launch {
            // Try to refresh the token before giving up
            val refreshToken = sessionManager.getRefreshToken()
            if (refreshToken != null) {
                try {
                    val response = RetrofitClient.api.refreshToken(
                        RefreshTokenRequest(refreshToken)
                    )
                    if (response.isSuccessful && response.body()?.success == true) {
                        val authResponse = response.body()!!
                        sessionManager.saveAuthToken(authResponse.token!!)
                        authResponse.user?.let { sessionManager.saveUser(it) }
                        Log.d(TAG, "Token refreshed successfully - reconnecting")
                        disconnect()
                        connect()
                        return@launch
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Token refresh failed", e)
                }
            }

            // Refresh failed or no refresh token — sign out
            Log.w(TAG, "Token refresh failed - clearing session and disconnecting")
            try {
                sessionManager.clearSession()
                configManager.deviceId = ""

                AnalyticsManager.capture(
                    event = "user_signed_out",
                    properties = mapOf(
                        "reason" to "unauthorized"
                    )
                )
                AnalyticsManager.reset()
                disconnect()

                Log.d(TAG, "Session cleared and disconnected due to unauthorized error")
            } catch (e: Exception) {
                Log.e(TAG, "Error handling unauthorized: ${e.message}", e)
            }
        }
    }

    /**
     * Handle task result from backend
     */
    private fun handleTaskResult(result: BackendWebSocketClient.TaskResult) {
        Log.d(
            TAG,
            "Task result - ID: ${result.taskId}, Success: ${result.success}, Reason: ${result.reason}"
        )

        // Stop voice recording if this was a voice command task
        if (activeVoiceTaskId == result.taskId) {
            Log.d(TAG, "Task ended, stopping voice recording")
            activeVoiceTaskId = null
            serviceScope.launch {
                transcriptionManager?.stopTranscription()
            }
        }

        // Track task completion or failure
        if (result.success) {
            AnalyticsManager.capture(
                event = "task_completed",
                properties = mapOf(
                    "task_id" to result.taskId,
                    "reason" to (result.reason ?: "success")
                )
            )
        } else {
            AnalyticsManager.capture(
                event = "task_failed",
                properties = mapOf(
                    "task_id" to result.taskId,
                    "reason" to (result.reason ?: "unknown")
                )
            )
        }

        // Forward to FloatingButtonService
        FloatingButtonService.getInstance()?.handleTaskResult(result)

        // Notify NotificationReplyManager for queue processing
        NotificationReplyManager.getInstance(applicationContext).onTaskResult(result)

        // Sync subscription/credit data after task completion
        // This ensures the UI shows accurate credit usage after credits are consumed
        // Use force=true to bypass cooldown since credits were just consumed
        if (result.success) {
            serviceScope.launch {
                try {
                    val subscriptionManager = SubscriptionManager.getInstance(applicationContext)
                    subscriptionManager.syncFromServer(force = true)
                    Log.d(TAG, "Credit usage synced after task completion")
                } catch (e: Exception) {
                    Log.e(TAG, "Error syncing credits after task: ${e.message}", e)
                }
            }
        }
    }

    /**
     * Submit a task to the backend server
     * @param command Natural language command from voice recognition
     * @param voiceCommandEnabled If true, enables voice command mode (streaming audio + TTS responses)
     * @return Task ID if submitted, null if not connected
     */
    suspend fun submitTask(command: String, voiceCommandEnabled: Boolean = false): String? {
        val client = wsClient
        if (client == null || !client.isOpen) {
            Log.w(TAG, "Cannot submit task: not connected")
            return null
        }

        return try {
            client.submitTask(command, voiceCommandEnabled)
        } catch (e: Exception) {
            Log.e(TAG, "Error submitting task: ${e.message}", e)
            null
        }
    }

    /**
     * Handle transcription messages from backend
     * Handles transcription_status, transcription_partial, transcription_committed, etc.
     */
    private fun handleTranscriptionMessage(json: JSONObject) {
        val type = json.optString("type")
        val taskId = json.optString("task_id")
        val sessionId = json.optString("session_id")

        when (type) {
            "transcription_status" -> {
                val status = json.optString("status")
                Log.d(TAG, "Transcription status: $status for task=$taskId, session=$sessionId")

                when (status) {
                    "started", "connected" -> {
                        // Backend started transcription session, start audio capture
                        if (sessionId.isNotEmpty()) {
                            startAudioCapture(taskId, sessionId)
                        }
                    }
                    "stopped", "disconnected" -> {
                        // Backend stopped transcription session
                        if (activeVoiceTaskId == taskId) {
                            stopAudioCapture()
                        }
                    }
                }
            }
            else -> {
                // Forward other transcription messages to TranscriptionManager
                transcriptionManager?.handleTranscriptionMessage(json)
            }
        }
    }

    /**
     * Start audio capture for a transcription session
     */
    private fun startAudioCapture(taskId: String, sessionId: String) {
        Log.d(TAG, "Starting audio capture: taskId=$taskId, sessionId=$sessionId")
        activeVoiceTaskId = taskId

        transcriptionManager?.let { tm ->
            // Set the callback to send binary audio via WebSocket
            tm.setSendBinaryCallback { buffer ->
                wsClient?.sendAudioChunk(buffer)
            }

            // Start audio capture only (session already started by backend)
            serviceScope.launch {
                val started = tm.startAudioCaptureOnly(sessionId)
                if (started) {
                    Log.d(TAG, "Audio capture started for session: $sessionId")
                } else {
                    Log.e(TAG, "Failed to start audio capture for session: $sessionId")
                }
            }
        }
    }

    /**
     * Stop audio capture
     */
    private fun stopAudioCapture() {
        Log.d(TAG, "Stopping audio capture for task: $activeVoiceTaskId")
        activeVoiceTaskId = null
        serviceScope.launch {
            transcriptionManager?.stopTranscription()
        }
    }

    /**
     * Handle agent response from backend for TTS
     * Speaks the text using TextToSpeech
     */
    private fun handleAgentResponse(taskId: String, text: String, responseType: String) {
        Log.d(TAG, "Agent response: taskId=$taskId, type=$responseType, text=$text")

        if (!ttsReady || textToSpeech == null) {
            Log.w(TAG, "TTS not ready, cannot speak agent response")
            return
        }

        // Speak the response
        serviceScope.launch(Dispatchers.Main) {
            try {
                // Use QUEUE_FLUSH to interrupt any current speech for immediate feedback
                val queueMode = if (responseType == "error" || responseType == "completed") {
                    TextToSpeech.QUEUE_FLUSH
                } else {
                    TextToSpeech.QUEUE_ADD
                }

                textToSpeech?.speak(text, queueMode, null, "agent_response_$taskId")
                Log.d(TAG, "TTS speaking: $text")
            } catch (e: Exception) {
                Log.e(TAG, "Error speaking agent response: ${e.message}", e)
            }
        }
    }

    /**
     * Check if voice command mode is currently active
     */
    fun isVoiceCommandActive(): Boolean = activeVoiceTaskId != null

    /**
     * Stop/cancel a running task
     * @param taskId The task ID to stop
     */
    suspend fun stopTask(taskId: String) {
        val client = wsClient
        if (client == null || !client.isOpen) {
            Log.w(TAG, "Cannot stop task: not connected")
            return
        }

        try {
            client.stopTask(taskId)
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping task: ${e.message}", e)
        }
    }

    /**
     * Get current connection status as string
     */
    fun getConnectionStatus(): String {
        return when (currentStatus) {
            BackendWebSocketClient.ConnectionStatus.CONNECTED -> "Connected"
            BackendWebSocketClient.ConnectionStatus.CONNECTING -> "Connecting"
            BackendWebSocketClient.ConnectionStatus.DISCONNECTED -> "Disconnected"
            BackendWebSocketClient.ConnectionStatus.ERROR -> "Error"
        }
    }

    /**
     * Handle task suggestions response from backend
     */
    private fun handleTaskSuggestionsResponse(response: BackendWebSocketClient.TaskSuggestionsResponse) {
        Log.d(TAG, "Task suggestions received - Success: ${response.success}, Count: ${response.suggestions.size}")
        onTaskSuggestionsReceived?.invoke(response)
    }

    /**
     * Set the callback for receiving task suggestions
     * @param callback The callback to invoke when suggestions are received
     */
    fun setTaskSuggestionsCallback(callback: ((BackendWebSocketClient.TaskSuggestionsResponse) -> Unit)?) {
        onTaskSuggestionsReceived = callback
    }

    /**
     * Request task suggestions from the backend based on current device state
     * @param stateFull Full device state JSON containing a11y_tree, phone_state, device_context (can be null if accessibility not enabled)
     * @param screenshotBase64 Optional base64-encoded screenshot
     * @param maxSuggestions Maximum number of suggestions to return
     * @return Request ID for tracking the response, or null if not connected
     */
    suspend fun requestTaskSuggestions(
        stateFull: org.json.JSONObject?,
        screenshotBase64: String? = null,
        maxSuggestions: Int = 5
    ): String? {
        val client = wsClient
        if (client == null || !client.isOpen) {
            Log.w(TAG, "Cannot request suggestions: not connected")
            return null
        }

        return try {
            client.requestTaskSuggestions(stateFull, screenshotBase64, maxSuggestions)
        } catch (e: Exception) {
            Log.e(TAG, "Error requesting suggestions: ${e.message}", e)
            null
        }
    }

    /**
     * Handle auto-reply response from backend
     */
    private fun handleAutoReplyResponse(response: BackendWebSocketClient.AutoReplyResponse) {
        Log.d(TAG, "Auto-reply response received - Success: ${response.success}, RequestId: ${response.requestId}")

        // Forward to NotificationReplyManager
        NotificationReplyManager.getInstance(applicationContext).onAutoReplyResponse(response)

        // Also forward to external callback if set
        onAutoReplyReceived?.invoke(response)
    }

    /**
     * Set the callback for receiving auto-reply responses
     */
    fun setAutoReplyCallback(callback: ((BackendWebSocketClient.AutoReplyResponse) -> Unit)?) {
        onAutoReplyReceived = callback
    }

    /**
     * Submit an auto-reply request to the backend
     * @return Request ID for tracking the response, or null if not connected
     */
    suspend fun submitAutoReplyRequest(
        packageName: String,
        senderName: String,
        messageText: String,
        conversationHistory: List<String>,
        customInstructions: String
    ): String? {
        val client = wsClient
        if (client == null || !client.isOpen) {
            Log.w(TAG, "Cannot submit auto-reply request: not connected")
            return null
        }

        return try {
            client.submitAutoReplyRequest(
                packageName = packageName,
                senderName = senderName,
                messageText = messageText,
                conversationHistory = conversationHistory,
                customInstructions = customInstructions
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error submitting auto-reply request: ${e.message}", e)
            null
        }
    }

    /**
     * Check if connected, and if not, attempt to reconnect
     */
    fun ensureConnected() {
        if (wsClient?.isOpen != true && configManager.backendWsEnabled) {
            Log.d(TAG, "Connection not active, attempting to reconnect")
            authFailedLogout = false  // Reset auth failure flag for fresh connection attempt
            serviceScope.launch {
                connect()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "BackendWebSocketService destroyed")

        // Clean up TTS
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        textToSpeech = null
        ttsReady = false

        // Clean up transcription
        serviceScope.launch {
            transcriptionManager?.stopTranscription()
        }

        instance = null
        disconnect()
        configManager.removeListener(this)
        serviceScope.cancel()
    }
}
