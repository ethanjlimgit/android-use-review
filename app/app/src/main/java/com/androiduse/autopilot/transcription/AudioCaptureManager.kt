package com.androiduse.autopilot.transcription

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import android.util.Log
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext

/**
 * Manages audio capture for real-time transcription.
 *
 * Captures PCM 16-bit mono audio at 16kHz and delivers chunks to a callback.
 */
class AudioCaptureManager(private val context: Context) {

    companion object {
        private const val TAG = "AudioCaptureManager"

        // Audio format matching ElevenLabs Scribe v2 requirements
        const val SAMPLE_RATE = 16000
        const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT

        // ~40ms chunks (640 samples * 2 bytes per sample = 1280 bytes)
        const val CHUNK_SIZE_BYTES = 1280
    }

    private var audioRecord: AudioRecord? = null
    private var isCapturing = false
    private var echoCanceler: AcousticEchoCanceler? = null
    private var noiseSuppressor: NoiseSuppressor? = null

    /**
     * Check if microphone permission is granted.
     */
    fun hasPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Start audio capture and deliver chunks to the callback.
     *
     * @param onChunk Callback invoked for each audio chunk (PCM 16-bit data)
     * @return true if capture started successfully, false otherwise
     */
    suspend fun startCapture(onChunk: suspend (ByteArray) -> Unit): Boolean {
        if (isCapturing) {
            Log.w(TAG, "Already capturing audio")
            return false
        }

        if (!hasPermission()) {
            Log.e(TAG, "Microphone permission not granted")
            return false
        }

        return withContext(Dispatchers.IO) {
            try {
                val minBufferSize = AudioRecord.getMinBufferSize(
                    SAMPLE_RATE,
                    CHANNEL_CONFIG,
                    AUDIO_FORMAT
                )

                if (minBufferSize == AudioRecord.ERROR || minBufferSize == AudioRecord.ERROR_BAD_VALUE) {
                    Log.e(TAG, "Invalid buffer size: $minBufferSize")
                    return@withContext false
                }

                // Use at least 2x chunk size or min buffer size, whichever is larger
                val bufferSize = maxOf(minBufferSize, CHUNK_SIZE_BYTES * 2)

                // Use VOICE_COMMUNICATION for built-in echo cancellation
                audioRecord = AudioRecord(
                    MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                    SAMPLE_RATE,
                    CHANNEL_CONFIG,
                    AUDIO_FORMAT,
                    bufferSize
                )

                if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                    Log.e(TAG, "AudioRecord failed to initialize")
                    audioRecord?.release()
                    audioRecord = null
                    return@withContext false
                }

                // Enable echo cancellation if available
                val audioSessionId = audioRecord?.audioSessionId ?: -1
                if (AcousticEchoCanceler.isAvailable()) {
                    try {
                        echoCanceler = AcousticEchoCanceler.create(audioSessionId)
                        echoCanceler?.enabled = true
                        Log.i(TAG, "Acoustic Echo Canceler enabled: ${echoCanceler?.enabled}")
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to enable AEC: ${e.message}")
                    }
                } else {
                    Log.w(TAG, "Acoustic Echo Canceler not available on this device")
                }

                // Enable noise suppression if available
                if (NoiseSuppressor.isAvailable()) {
                    try {
                        noiseSuppressor = NoiseSuppressor.create(audioSessionId)
                        noiseSuppressor?.enabled = true
                        Log.i(TAG, "Noise Suppressor enabled: ${noiseSuppressor?.enabled}")
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to enable NS: ${e.message}")
                    }
                } else {
                    Log.w(TAG, "Noise Suppressor not available on this device")
                }

                audioRecord?.startRecording()
                isCapturing = true
                Log.i(TAG, "Audio capture started (sample rate: $SAMPLE_RATE Hz, buffer: $bufferSize bytes, AEC/NS enabled)")

                // Read and deliver audio chunks
                val buffer = ByteArray(CHUNK_SIZE_BYTES)
                while (isCapturing && isActive) {
                    val bytesRead = audioRecord?.read(buffer, 0, CHUNK_SIZE_BYTES) ?: -1

                    if (bytesRead > 0) {
                        // Deliver chunk (copy to avoid buffer reuse issues)
                        val chunk = if (bytesRead == CHUNK_SIZE_BYTES) {
                            buffer.copyOf()
                        } else {
                            buffer.copyOf(bytesRead)
                        }
                        onChunk(chunk)
                    } else if (bytesRead < 0) {
                        Log.e(TAG, "AudioRecord.read error: $bytesRead")
                        break
                    }
                }

                true
            } catch (e: SecurityException) {
                Log.e(TAG, "Security exception during audio capture", e)
                false
            } catch (e: Exception) {
                Log.e(TAG, "Error during audio capture", e)
                false
            }
        }
    }

    /**
     * Stop audio capture.
     */
    fun stopCapture() {
        isCapturing = false

        // Release audio effects
        try {
            echoCanceler?.release()
            noiseSuppressor?.release()
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing audio effects", e)
        }
        echoCanceler = null
        noiseSuppressor = null

        audioRecord?.let { record ->
            try {
                if (record.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                    record.stop()
                }
                record.release()
                Log.i(TAG, "Audio capture stopped")
            } catch (e: Exception) {
                Log.e(TAG, "Error stopping audio capture", e)
            }
        }
        audioRecord = null
    }

    /**
     * Check if currently capturing audio.
     */
    fun isCapturing(): Boolean = isCapturing
}
