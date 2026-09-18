package com.androiduse.autopilot.client

import android.util.Log
import com.androiduse.autopilot.api.ApiResponse
import com.androiduse.autopilot.service.ActionDispatcher
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import org.json.JSONArray
import org.json.JSONObject
import java.net.URI
import java.nio.ByteBuffer
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * WebSocket client that connects to the backend server
 * Handles bidirectional JSON-RPC communication and task submission
 */
class BackendWebSocketClient(
    serverUri: URI,
    private val actionDispatcher: ActionDispatcher,
    private val authToken: String,
    private val deviceId: String,
    private val onResultReceived: (TaskResult) -> Unit,
    private val onConnectionStatusChanged: (ConnectionStatus) -> Unit,
    private val onUnauthorized: (() -> Unit)? = null,
    private val onTranscriptionMessage: ((JSONObject) -> Unit)? = null,
    private val onAgentResponse: ((String, String, String) -> Unit)? = null, // (taskId, text, responseType)
    private val onTaskSuggestionsReceived: ((TaskSuggestionsResponse) -> Unit)? = null,
    private val onAutoReplyResponse: ((AutoReplyResponse) -> Unit)? = null
) : WebSocketClient(serverUri) {

    init {
        // Add authentication headers
        addHeader("Authorization", "Bearer $authToken")
        addHeader("X-Device-Id", deviceId)
    }

    companion object {
        private const val TAG = "BackendWSClient"
    }

    enum class ConnectionStatus {
        DISCONNECTED, CONNECTING, CONNECTED, ERROR
    }

    data class TaskResult(
        val taskId: String,
        val success: Boolean,
        val reason: String,
        val steps: Int,
        val structuredOutput: Any?
    )

    /**
     * Represents a single task suggestion from the backend
     */
    data class TaskSuggestion(
        val title: String,
        val description: String,
        val command: String
    )

    /**
     * Response containing task suggestions
     */
    data class TaskSuggestionsResponse(
        val requestId: String,
        val success: Boolean,
        val contextSummary: String,
        val suggestions: List<TaskSuggestion>,
        val error: String?
    )

    /**
     * Response from the backend for an auto-reply request
     */
    data class AutoReplyResponse(
        val requestId: String,
        val success: Boolean,
        val replyText: String?,
        val error: String?
    )

    /**
     * Represents a queued action to be executed sequentially
     */
    private data class QueuedAction(
        val id: String,
        val method: String,
        val params: JSONObject
    )

    private val pendingResponses = ConcurrentHashMap<String, CompletableDeferred<JSONObject>>()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // Action queue for sequential execution
    private var actionQueue = Channel<QueuedAction>(Channel.UNLIMITED)
    private var queueProcessorJob: Job? = null

    override fun onOpen(handshake: ServerHandshake?) {
        Log.d(TAG, "WebSocket connection opened")
        onConnectionStatusChanged(ConnectionStatus.CONNECTED)
        startActionQueueProcessor()
    }

    override fun onMessage(message: String?) {
        if (message == null) return

        scope.launch {
            try {
                val json = JSONObject(message)
                Log.d(TAG, "Received message: $message")

                // Check message type for voice command messages
                val messageType = json.optString("type", "")

                when {
                    // Agent response - text to be spoken via TTS
                    messageType == "agent_response" -> {
                        val taskId = json.optString("task_id")
                        val text = json.optString("text")
                        val responseType = json.optString("response_type", "status")
                        Log.d(TAG, "Agent response received - Task: $taskId, Type: $responseType, Text: $text")
                        onAgentResponse?.invoke(taskId, text, responseType)
                    }
                    // Transcription messages (partial, committed, status, error)
                    // transcription_status with status="started" triggers audio recording
                    messageType.startsWith("transcription_") -> {
                        Log.d(TAG, "Transcription message received: $messageType")
                        onTranscriptionMessage?.invoke(json)
                    }
                    // Task suggestions response
                    messageType == "suggest_tasks_response" -> {
                        Log.d(TAG, "Task suggestions received")
                        handleTaskSuggestionsResponse(json)
                    }
                    // Auto-reply response
                    messageType == "auto_reply_response" -> {
                        Log.d(TAG, "Auto-reply response received")
                        handleAutoReplyResponse(json)
                    }
                    // Memory replay - execute pre-recorded actions without LLM
                    messageType == "memory_replay" -> {
                        val taskId = json.optString("task_id")
                        val actions = json.optJSONArray("actions") ?: JSONArray()
                        val similarity = json.optDouble("similarity", 0.0)
                        Log.d(TAG, "Memory replay received - Task: $taskId, Actions: ${actions.length()}, Similarity: $similarity")
                        scope.launch {
                            val result = MemoryReplayExecutor(actionDispatcher).execute(actions)
                            val response = JSONObject().apply {
                                put("type", "memory_replay_result")
                                put("task_id", taskId)
                                put("success", result.success)
                                put("steps_completed", result.stepsCompleted)
                                if (!result.success) {
                                    put("reason", result.reason)
                                    put("failed_at_step", result.failedAtStep)
                                }
                            }
                            withContext(Dispatchers.IO) { send(response.toString()) }
                        }
                    }
                    // JSON-RPC request from backend - enqueue for sequential execution
                    json.has("method") && json.has("id") -> {
                        val id = json.getString("id")
                        val method = json.getString("method")
                        val params = json.optJSONObject("params") ?: JSONObject()

                        val action = QueuedAction(id, method, params)
                        try {
                            actionQueue.send(action)
                            Log.d(TAG, "Action enqueued - ID: $id, Method: $method")
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to enqueue action: ${e.message}")
                            // Send error response if queue is closed
                            try {
                                val errorResponse = JSONObject().apply {
                                    put("id", id)
                                    put("status", "error")
                                    put("error", "Action queue is closed")
                                }
                                withContext(Dispatchers.IO) {
                                    send(errorResponse.toString())
                                }
                            } catch (sendError: Exception) {
                                Log.e(TAG, "Failed to send error response: ${sendError.message}")
                            }
                        }
                    }
                    // Final task result
                    json.has("status") && json.has("task_id") -> {
                        handleTaskResult(json)
                    }
                    // Acknowledgment
                    json.has("status") && json.getString("status") == "accepted" -> {
                        Log.d(TAG, "Task accepted: ${json.optString("message")}")
                    }
                    // Error response
                    json.has("status") && json.getString("status") == "error" -> {
                        val errorMessage = json.optString("error")
                        Log.e(TAG, "Server error: $errorMessage")

                        // Check for unauthorized/authentication errors
                        if (errorMessage.contains("unauthorized", ignoreCase = true) ||
                            errorMessage.contains("authentication", ignoreCase = true) ||
                            errorMessage.contains("token", ignoreCase = true)) {
                            Log.w(TAG, "Authentication error from server - triggering sign out")
                            onUnauthorized?.invoke()
                        }
                    }
                    else -> {
                        Log.w(TAG, "Unknown message format: $message")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error handling message: ${e.message}", e)
            }
        }
    }

    override fun onMessage(bytes: ByteBuffer?) {
        if (bytes == null || bytes.remaining() < 36) return

        scope.launch {
            try {
                // Extract UUID prefix (36 bytes)
                val uuidBytes = ByteArray(36)
                bytes.get(uuidBytes)
                val uuid = String(uuidBytes)

                // Extract binary payload
                val payload = ByteArray(bytes.remaining())
                bytes.get(payload)

                Log.d(TAG, "Received binary message for request: $uuid, size: ${payload.size} bytes")

                // Route to pending response if exists
                val deferred = pendingResponses.remove(uuid)
                if (deferred != null) {
                    val response = JSONObject().apply {
                        put("status", "success")
                        put("binary", true)
                        put("size", payload.size)
                    }
                    deferred.complete(response)
                } else {
                    Log.w(TAG, "No pending request found for UUID: $uuid")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error handling binary message: ${e.message}", e)
            }
        }
    }

    override fun onClose(code: Int, reason: String?, remote: Boolean) {
        Log.d(TAG, "WebSocket closed - Code: $code, Reason: $reason, Remote: $remote")
        onConnectionStatusChanged(ConnectionStatus.DISCONNECTED)

        // Stop queue processor
        stopActionQueueProcessor()

        // Cancel all pending responses
        pendingResponses.values.forEach { it.cancel() }
        pendingResponses.clear()
    }

    override fun onError(ex: Exception?) {
        Log.e(TAG, "WebSocket error: ${ex?.message}", ex)

        // Check if it's an authentication error
        val message = ex?.message?.lowercase() ?: ""
        if (message.contains("401") || message.contains("unauthorized")) {
            Log.w(TAG, "Unauthorized WebSocket connection - triggering sign out")
            onUnauthorized?.invoke()
        }

        onConnectionStatusChanged(ConnectionStatus.ERROR)
    }

    /**
     * Submit a task to the backend
     * @param command Natural language command from voice recognition
     * @param voiceCommandEnabled If true, enables voice command mode (streaming audio + TTS responses)
     * @return Task ID
     */
    suspend fun submitTask(
        command: String,
        voiceCommandEnabled: Boolean = false,
        noMemorisedTask: Boolean = false
    ): String {
        val taskId = UUID.randomUUID().toString()

        val request = JSONObject().apply {
            put("task_id", taskId)
            put("command", command)
            put("voice_command_enabled", voiceCommandEnabled)
            if (noMemorisedTask) put("no_memorised_task", true)
        }

        withContext(Dispatchers.IO) {
            send(request.toString())
            Log.d(TAG, "Task submitted - ID: $taskId, Command: $command, VoiceMode: $voiceCommandEnabled")
        }

        return taskId
    }

    /**
     * Stop/cancel a running task
     * @param taskId The task ID to stop
     */
    suspend fun stopTask(taskId: String) {
        val request = JSONObject().apply {
            put("type", "cancel_task")
            put("task_id", taskId)
        }

        withContext(Dispatchers.IO) {
            send(request.toString())
            Log.d(TAG, "Cancel task message sent - Task ID: $taskId")
        }
    }

    /**
     * Send audio chunk for transcription.
     *
     * The audio is sent as binary with a 36-byte session UUID prefix.
     *
     * @param buffer ByteBuffer containing [36-byte session UUID] + [PCM audio data]
     */
    fun sendAudioChunk(buffer: ByteBuffer) {
        try {
            send(buffer)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending audio chunk: ${e.message}")
        }
    }

    /**
     * Send a JSON message (for transcription control messages)
     * @param json The JSON message to send
     */
    suspend fun sendJsonMessage(json: JSONObject) {
        withContext(Dispatchers.IO) {
            send(json.toString())
            Log.d(TAG, "Sent JSON message: ${json.optString("type")}")
        }
    }

    /**
     * Check if an action modifies the UI and should auto-reply with state
     */
    private fun shouldAutoReplyWithState(method: String): Boolean {
        val normalizedMethod = method.removePrefix("/action/")
            .removePrefix("action.")
            .removePrefix("/")

        return when (normalizedMethod) {
            "tap", "click" -> true
            "swipe" -> true
            "app", "app/start" -> true
            "keyevent", "key", "keyboard/key" -> true
            "keyboard/input", "input" -> true
            "keyboard/clear", "clear" -> true
            "global" -> true
            else -> false
        }
    }

    /**
     * Start the action queue processor that executes actions sequentially
     */
    @OptIn(ExperimentalCoroutinesApi::class)
    private fun startActionQueueProcessor() {
        // Cancel any existing processor
        queueProcessorJob?.cancel()

        // Recreate channel if it's closed
        if (actionQueue.isClosedForSend) {
            actionQueue = Channel(Channel.UNLIMITED)
            Log.d(TAG, "Action queue recreated")
        }

        queueProcessorJob = scope.launch {
            Log.d(TAG, "Action queue processor started")

            try {
                for (action in actionQueue) {
                    try {
                        Log.d(TAG, "Processing queued action - ID: ${action.id}, Method: ${action.method}")
                        processAction(action.id, action.method, action.params)
                    } catch (e: Exception) {
                        Log.e(TAG, "Error processing queued action ${action.id}: ${e.message}", e)

                        // Send error response
                        try {
                            val errorResponse = JSONObject().apply {
                                put("id", action.id)
                                put("status", "error")
                                put("error", e.message ?: "Unknown error")
                            }

                            withContext(Dispatchers.IO) {
                                send(errorResponse.toString())
                            }
                        } catch (sendError: Exception) {
                            Log.e(TAG, "Failed to send error response: ${sendError.message}")
                        }
                    }
                }
            } catch (e: Exception) {
                if (e !is CancellationException) {
                    Log.e(TAG, "Action queue processor error: ${e.message}", e)
                }
            }

            Log.d(TAG, "Action queue processor stopped")
        }
    }

    /**
     * Stop the action queue processor
     */
    private fun stopActionQueueProcessor() {
        queueProcessorJob?.cancel()
        queueProcessorJob = null
        actionQueue.close()
        Log.d(TAG, "Action queue processor stopped and queue closed")
    }

    /**
     * Get adaptive sleep duration based on action type (in milliseconds)
     */
    private fun getAdaptiveSleepDuration(method: String): Long {
        val normalizedMethod = method.removePrefix("/action/")
            .removePrefix("action.")
            .removePrefix("/")

        return when (normalizedMethod) {
            "tap", "click" -> 300L       // Reduced from 500ms
            "swipe" -> 400L               // Reduced from 400ms
            "app", "app/start" -> 1000L   // Reduced from 1500ms
            "keyevent", "key", "keyboard/key" -> 300L  // Reduced from 300ms
            "keyboard/input", "input" -> 300L          // Reduced from 300ms
            "keyboard/clear", "clear" -> 200L          // Reduced from 200ms
            "global" -> 200L              // Reduced from 500ms
            else -> 150L                  // Reduced from 300ms
        }
    }

    /**
     * Process a single action from the queue
     */
    private suspend fun processAction(id: String, method: String, params: JSONObject) {
        Log.d(TAG, "Processing action - ID: $id, Method: $method")

        try {
            // Track action execution time
            val actionStartTime = System.currentTimeMillis()

            // Dispatch to ActionDispatcher
            val result = withContext(Dispatchers.IO) {
                actionDispatcher.dispatch(
                    action = method,
                    params = params,
                    origin = ActionDispatcher.Origin.WEBSOCKET
                )
            }

            val actionDuration = System.currentTimeMillis() - actionStartTime

            // Send response back to backend
            when (result) {
                is ApiResponse.Binary -> {
                    // Send binary response with UUID prefix
                    val responseBytes = ByteBuffer.allocate(36 + result.data.size)
                    responseBytes.put(id.toByteArray())
                    responseBytes.put(result.data)
                    responseBytes.flip()

                    withContext(Dispatchers.IO) {
                        send(responseBytes)
                    }
                    Log.d(TAG, "Sent binary response for $id: ${result.data.size} bytes")
                }
                is ApiResponse.Error -> {
                    // Send error response immediately
                    val errorResponse = JSONObject().apply {
                        put("id", id)
                        put("status", "error")
                        put("error", result.message)
                    }

                    withContext(Dispatchers.IO) {
                        send(errorResponse.toString())
                    }
                    Log.e(TAG, "Sent error response for $id: ${result.message}")
                }
                else -> {
                    // Check if this action should auto-reply with state
                    if (shouldAutoReplyWithState(method)) {
                        // Calculate adaptive sleep duration accounting for action execution time
                        val baseSleepDuration = getAdaptiveSleepDuration(method)
                        val adjustedSleep = maxOf(0L, baseSleepDuration - actionDuration)

                        Log.d(TAG, "UI-modifying action detected. Action took ${actionDuration}ms, sleeping ${adjustedSleep}ms before fetching state")

                        // Wait for UI to settle
                        if (adjustedSleep > 0) {
                            delay(adjustedSleep)
                        }

                        // Automatically fetch state
                        val stateResult = withContext(Dispatchers.IO) {
                            actionDispatcher.dispatch(
                                action = "state_full",
                                params = JSONObject(),
                                origin = ActionDispatcher.Origin.WEBSOCKET
                            )
                        }

                        // Send response with state
                        val response = JSONObject().apply {
                            put("id", id)
                            put("status", "success")

                            when (stateResult) {
                                is ApiResponse.RawObject -> {
                                    put("result", stateResult.json)
                                }
                                is ApiResponse.Success -> {
                                    stateResult.data?.let { put("result", it) }
                                }
                                else -> {
                                    Log.w(TAG, "Unexpected state result type: ${stateResult::class.simpleName}")
                                    put("result", null)
                                }
                            }
                        }

                        val responseString = response.toString()
                        withContext(Dispatchers.IO) {
                            send(responseString)
                        }
                        Log.d(TAG, "Sent auto-state response for $id - Size: ${responseString.length} chars")
                    } else {
                        // Send normal JSON response without state
                        val response = JSONObject().apply {
                            put("id", id)
                            put("status", "success")

                            when (result) {
                                is ApiResponse.Success -> {
                                    result.data?.let { put("result", it) }
                                }
                                is ApiResponse.RawObject -> {
                                    put("result", result.json)
                                }
                                is ApiResponse.RawArray -> {
                                    put("result", result.json)
                                }
                                is ApiResponse.Text -> {
                                    put("result", result.data)
                                }
                                else -> {
                                    Log.w(TAG, "Unknown ApiResponse type: ${result::class.simpleName}")
                                    put("result", null)
                                }
                            }
                        }

                        val responseString = response.toString()
                        withContext(Dispatchers.IO) {
                            send(responseString)
                        }
                        Log.d(TAG, "Sent JSON response for $id - Status: ${response.optString("status")}, Size: ${responseString.length} chars")
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error executing JSON-RPC request: ${e.message}", e)

            // Send error response
            val errorResponse = JSONObject().apply {
                put("id", id)
                put("status", "error")
                put("error", e.message ?: "Unknown error")
            }

            withContext(Dispatchers.IO) {
                send(errorResponse.toString())
            }
        }
    }

    /**
     * Handle final task result from backend
     */
    private fun handleTaskResult(json: JSONObject) {
        val taskId = json.getString("task_id")
        val status = json.getString("status")

        if (status == "completed") {
            val resultObj = json.optJSONObject("result")

            val taskResult = TaskResult(
                taskId = taskId,
                success = resultObj?.optBoolean("success") ?: false,
                reason = resultObj?.optString("reason") ?: "Unknown",
                steps = resultObj?.optInt("steps") ?: 0,
                structuredOutput = resultObj?.opt("structured_output")
            )

            Log.d(TAG, "Task result received - ID: $taskId, Success: ${taskResult.success}")
            onResultReceived(taskResult)
        } else {
            Log.w(TAG, "Unexpected task status: $status for task $taskId")
        }
    }

    /**
     * Handle task suggestions response from backend
     */
    private fun handleTaskSuggestionsResponse(json: JSONObject) {
        val requestId = json.optString("request_id", "")
        val success = json.optBoolean("success", false)
        val contextSummary = json.optString("context_summary", "")
        val error = json.optString("error", null)

        val suggestions = mutableListOf<TaskSuggestion>()
        val suggestionsArray = json.optJSONArray("suggestions")
        if (suggestionsArray != null) {
            for (i in 0 until suggestionsArray.length()) {
                val suggestionJson = suggestionsArray.optJSONObject(i)
                if (suggestionJson != null) {
                    suggestions.add(
                        TaskSuggestion(
                            title = suggestionJson.optString("title", ""),
                            description = suggestionJson.optString("description", ""),
                            command = suggestionJson.optString("command", "")
                        )
                    )
                }
            }
        }

        val response = TaskSuggestionsResponse(
            requestId = requestId,
            success = success,
            contextSummary = contextSummary,
            suggestions = suggestions,
            error = error
        )

        Log.d(TAG, "Task suggestions response - Success: $success, Count: ${suggestions.size}")
        onTaskSuggestionsReceived?.invoke(response)
    }

    /**
     * Request task suggestions from the backend based on current device state
     * @param stateFull Full device state JSON containing a11y_tree, phone_state, device_context (can be null if accessibility not enabled)
     * @param screenshotBase64 Optional base64-encoded screenshot
     * @param maxSuggestions Maximum number of suggestions to return
     * @return Request ID for tracking the response
     */
    suspend fun requestTaskSuggestions(
        stateFull: JSONObject?,
        screenshotBase64: String? = null,
        maxSuggestions: Int = 5
    ): String {
        val requestId = UUID.randomUUID().toString()

        val request = JSONObject().apply {
            put("type", "suggest_tasks")
            put("request_id", requestId)
            if (stateFull != null) {
                put("state_full", stateFull)
            }
            if (screenshotBase64 != null) {
                put("screenshot_base64", screenshotBase64)
            }
            put("max_suggestions", maxSuggestions)
        }

        withContext(Dispatchers.IO) {
            send(request.toString())
            Log.d(TAG, "Task suggestions request sent - ID: $requestId (with state: ${stateFull != null})")
        }

        return requestId
    }

    /**
     * Submit an auto-reply request to the backend
     * @param packageName Source app package name
     * @param senderName Sender name/contact
     * @param messageText The incoming message text
     * @param conversationHistory Recent conversation messages for context
     * @param customInstructions User-defined reply instructions
     * @return Request ID for tracking the response
     */
    suspend fun submitAutoReplyRequest(
        packageName: String,
        senderName: String,
        messageText: String,
        conversationHistory: List<String>,
        customInstructions: String
    ): String {
        val requestId = UUID.randomUUID().toString()

        val request = JSONObject().apply {
            put("type", "auto_reply_request")
            put("request_id", requestId)
            put("package_name", packageName)
            put("sender_name", senderName)
            put("message_text", messageText)
            put("conversation_history", JSONArray(conversationHistory))
            put("custom_instructions", customInstructions)
        }

        withContext(Dispatchers.IO) {
            send(request.toString())
            Log.d(TAG, "Auto-reply request sent - ID: $requestId, Sender: $senderName")
        }

        return requestId
    }

    /**
     * Handle auto-reply response from backend
     */
    private fun handleAutoReplyResponse(json: JSONObject) {
        val response = AutoReplyResponse(
            requestId = json.optString("request_id", ""),
            success = json.optBoolean("success", false),
            replyText = json.optString("reply_text", null),
            error = json.optString("error", null)
        )

        Log.d(TAG, "Auto-reply response - Success: ${response.success}, Text: ${response.replyText?.take(50)}")
        onAutoReplyResponse?.invoke(response)
    }

    /**
     * Close connection and cleanup
     */
    fun closeConnection() {
        stopActionQueueProcessor()
        scope.cancel()
        close()
    }
}
