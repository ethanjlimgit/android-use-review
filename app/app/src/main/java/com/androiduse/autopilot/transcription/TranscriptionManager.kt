package com.androiduse.autopilot.transcription

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.nio.ByteBuffer
import java.util.UUID

/**
 * High-level manager for real-time transcription.
 *
 * Coordinates audio capture and WebSocket communication with the backend
 * for ElevenLabs Scribe v2 transcription.
 *
 * Flow:
 * 1. Android captures audio and sends to backend
 * 2. Backend forwards audio to ElevenLabs Scribe v2
 * 3. ElevenLabs returns transcripts to backend
 * 4. Backend injects transcripts directly into the active agent
 * 5. Backend also sends transcripts back to Android for UI display
 */
class TranscriptionManager(
    context: Context,
    private val scope: CoroutineScope
) {
    companion object {
        private const val TAG = "TranscriptionManager"
    }

    private val audioCaptureManager = AudioCaptureManager(context)

    // Current transcription session ID (should match task_id for agent routing)
    private var sessionId: String? = null

    // Audio capture job
    private var captureJob: Job? = null

    // Callback to send data to WebSocket
    private var sendBinaryCallback: ((ByteBuffer) -> Unit)? = null
    private var sendJsonCallback: ((JSONObject) -> Unit)? = null

    // Event callbacks
    var onPartialTranscript: ((String) -> Unit)? = null
    var onCommittedTranscript: ((String, Boolean) -> Unit)? = null
    var onError: ((String) -> Unit)? = null
    var onStatusChanged: ((TranscriptionStatus) -> Unit)? = null

    enum class TranscriptionStatus {
        IDLE,
        STARTING,
        ACTIVE,
        STOPPING,
        ERROR
    }

    private var status = TranscriptionStatus.IDLE

    /**
     * Set the callback for sending binary data (audio chunks) via WebSocket.
     */
    fun setSendBinaryCallback(callback: (ByteBuffer) -> Unit) {
        sendBinaryCallback = callback
    }

    /**
     * Set the callback for sending JSON messages via WebSocket.
     */
    fun setSendJsonCallback(callback: (JSONObject) -> Unit) {
        sendJsonCallback = callback
    }

    /**
     * Check if microphone permission is granted.
     */
    fun hasPermission(): Boolean = audioCaptureManager.hasPermission()

    /**
     * Start a transcription session.
     *
     * @param language Optional language code (e.g., "en") for transcription. Null for auto-detect.
     * @param taskId Task ID to associate with this transcription session.
     *               The backend uses this to route transcripts to the correct agent.
     *               If not provided, a random UUID is used (transcripts won't be injected into agent).
     * @return true if started successfully, false otherwise
     */
    suspend fun startTranscription(language: String? = null, taskId: String? = null): Boolean {
        if (status == TranscriptionStatus.ACTIVE || status == TranscriptionStatus.STARTING) {
            Log.w(TAG, "Transcription already active or starting")
            return false
        }

        if (!hasPermission()) {
            Log.e(TAG, "Microphone permission not granted")
            onError?.invoke("Microphone permission not granted")
            return false
        }

        updateStatus(TranscriptionStatus.STARTING)

        // Use taskId as session ID for agent routing, or generate UUID if not provided
        sessionId = taskId ?: UUID.randomUUID().toString()
        val currentSessionId = sessionId ?: return false

        // Send transcription_start message to backend
        val startMessage = JSONObject().apply {
            put("type", "transcription_start")
            put("session_id", currentSessionId)
            language?.let { put("language", it) }
        }

        sendJsonCallback?.invoke(startMessage)
            ?: run {
                Log.e(TAG, "No JSON send callback configured")
                updateStatus(TranscriptionStatus.ERROR)
                onError?.invoke("WebSocket not connected")
                return false
            }

        // Start audio capture
        captureJob = scope.launch(Dispatchers.IO) {
            val success = audioCaptureManager.startCapture { audioChunk ->
                sendAudioChunk(currentSessionId, audioChunk)
            }

            if (!success) {
                Log.e(TAG, "Failed to start audio capture")
                updateStatus(TranscriptionStatus.ERROR)
                onError?.invoke("Failed to start audio capture")
            }
        }

        updateStatus(TranscriptionStatus.ACTIVE)
        Log.i(TAG, "Transcription session started: $currentSessionId")
        return true
    }

    /**
     * Start audio capture only (session already started by backend).
     *
     * Use this when the backend has already started the transcription session
     * and sent a voice_command_start message. This skips sending transcription_start.
     *
     * @param sessionId The session ID provided by the backend
     * @return true if capture started successfully, false otherwise
     */
    suspend fun startAudioCaptureOnly(sessionId: String): Boolean {
        if (status == TranscriptionStatus.ACTIVE || status == TranscriptionStatus.STARTING) {
            Log.w(TAG, "Transcription already active or starting")
            return false
        }

        if (!hasPermission()) {
            Log.e(TAG, "Microphone permission not granted")
            onError?.invoke("Microphone permission not granted")
            return false
        }

        if (sendBinaryCallback == null) {
            Log.e(TAG, "No binary send callback configured")
            onError?.invoke("WebSocket not configured")
            return false
        }

        updateStatus(TranscriptionStatus.STARTING)
        this.sessionId = sessionId

        // Start audio capture (session already started by backend)
        captureJob = scope.launch(Dispatchers.IO) {
            val success = audioCaptureManager.startCapture { audioChunk ->
                sendAudioChunk(sessionId, audioChunk)
            }

            if (!success) {
                Log.e(TAG, "Failed to start audio capture")
                updateStatus(TranscriptionStatus.ERROR)
                onError?.invoke("Failed to start audio capture")
            }
        }

        updateStatus(TranscriptionStatus.ACTIVE)
        Log.i(TAG, "Audio capture started for session: $sessionId (backend-initiated)")
        return true
    }

    /**
     * Stop the current transcription session.
     *
     * @param sendStopMessage If true, sends transcription_stop to backend.
     *                        Set to false when backend already stopped the session.
     */
    suspend fun stopTranscription(sendStopMessage: Boolean = false) {
        val currentSessionId = sessionId ?: run {
            Log.w(TAG, "No active transcription session")
            return
        }

        updateStatus(TranscriptionStatus.STOPPING)

        // Stop audio capture
        captureJob?.cancel()
        captureJob = null
        audioCaptureManager.stopCapture()

        // Only send transcription_stop if requested (not needed when backend stopped session)
        if (sendStopMessage) {
            val stopMessage = JSONObject().apply {
                put("type", "transcription_stop")
                put("session_id", currentSessionId)
            }
            sendJsonCallback?.invoke(stopMessage)
        }

        sessionId = null
        updateStatus(TranscriptionStatus.IDLE)
        Log.i(TAG, "Transcription session stopped: $currentSessionId")
    }

    /**
     * Handle incoming transcription message from the backend.
     *
     * @param json The JSON message from the backend
     */
    fun handleTranscriptionMessage(json: JSONObject) {
        val type = json.optString("type")
        val msgSessionId = json.optString("session_id")

        // Verify session ID matches (if we have an active session)
        if (sessionId != null && msgSessionId.isNotEmpty() && msgSessionId != sessionId) {
            Log.w(TAG, "Received message for different session: $msgSessionId (expected: $sessionId)")
            return
        }

        when (type) {
            "transcription_partial" -> {
                val text = json.optString("text")
                if (text.isNotEmpty()) {
                    Log.d(TAG, "Partial transcript: $text")
                    onPartialTranscript?.invoke(text)
                }
            }

            "transcription_committed" -> {
                val text = json.optString("text")
                val isFinal = json.optBoolean("is_final", false)
                if (text.isNotEmpty()) {
                    Log.i(TAG, "Committed transcript (final=$isFinal): $text")
                    // Note: The backend automatically injects transcripts into the agent
                    // This callback is for UI updates on the phone
                    onCommittedTranscript?.invoke(text, isFinal)
                }
            }

            "transcription_error" -> {
                val error = json.optString("error")
                Log.e(TAG, "Transcription error: $error")
                updateStatus(TranscriptionStatus.ERROR)
                onError?.invoke(error)
            }

            "transcription_status" -> {
                val statusStr = json.optString("status")
                Log.d(TAG, "Transcription status: $statusStr")
                when (statusStr) {
                    "started", "connected" -> updateStatus(TranscriptionStatus.ACTIVE)
                    "stopped", "disconnected" -> updateStatus(TranscriptionStatus.IDLE)
                }
            }

            else -> {
                Log.w(TAG, "Unknown transcription message type: $type")
            }
        }
    }

    /**
     * Send an audio chunk to the backend.
     *
     * Format: [36-byte session UUID] + [PCM audio data]
     */
    private fun sendAudioChunk(sessionId: String, audioData: ByteArray) {
        val callback = sendBinaryCallback ?: run {
            Log.w(TAG, "No binary send callback configured")
            return
        }

        // Create buffer: 36 bytes UUID + audio data
        val sessionIdBytes = sessionId.toByteArray(Charsets.UTF_8)
        val buffer = ByteBuffer.allocate(36 + audioData.size)

        // Pad or truncate session ID to exactly 36 bytes
        if (sessionIdBytes.size >= 36) {
            buffer.put(sessionIdBytes, 0, 36)
        } else {
            buffer.put(sessionIdBytes)
            // Pad with spaces if needed
            repeat(36 - sessionIdBytes.size) {
                buffer.put(' '.code.toByte())
            }
        }

        buffer.put(audioData)
        buffer.flip()

        //Log.d(TAG, "Sending binary audio to backend: ${audioData.size} bytes for session $sessionId")
        callback.invoke(buffer)
    }

    private fun updateStatus(newStatus: TranscriptionStatus) {
        if (status != newStatus) {
            status = newStatus
            onStatusChanged?.invoke(newStatus)
        }
    }

    /**
     * Get the current transcription status.
     */
    fun getStatus(): TranscriptionStatus = status

    /**
     * Check if transcription is currently active.
     */
    fun isActive(): Boolean = status == TranscriptionStatus.ACTIVE

    /**
     * Get the current session ID, if any.
     */
    fun getSessionId(): String? = sessionId
}
