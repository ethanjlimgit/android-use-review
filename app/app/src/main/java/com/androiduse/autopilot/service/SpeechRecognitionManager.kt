package com.androiduse.autopilot.service

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import android.view.View
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.androiduse.autopilot.config.ConfigManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Manages speech recognition for voice input
 * Uses cloud-based recognition for better accuracy
 */
class SpeechRecognitionManager(
    private val context: Context,
    private val scope: CoroutineScope
) {
    companion object {
        private const val TAG = "SpeechRecognitionMgr"
    }

    private var speechRecognizer: SpeechRecognizer? = null
    private var isListening = false

    // UI components for visual feedback
    private var partialSpeechTextView: TextView? = null

    // Callbacks
    var onSpeechStarted: (() -> Unit)? = null
    var onSpeechEnded: (() -> Unit)? = null
    var onResults: ((String) -> Unit)? = null
    var onError: ((String) -> Unit)? = null
    var onPartialResults: ((String) -> Unit)? = null

    /**
     * Initialize speech recognizer
     */
    fun initialize() {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            Log.w(TAG, "Speech recognition not available")
            return
        }

        Log.d(TAG, "Initializing cloud-based speech recognition")
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context)
        speechRecognizer?.setRecognitionListener(createRecognitionListener())
    }

    /**
     * Set the TextView for displaying partial results
     */
    fun setPartialResultsView(textView: TextView?) {
        partialSpeechTextView = textView
    }

    /**
     * Check if microphone permission is granted
     */
    fun hasAudioPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Start speech recognition
     */
    fun startListening() {
        if (isListening) {
            Log.w(TAG, "Already listening")
            return
        }

        // Get configured language or use device default
        val configManager = ConfigManager.getInstance(context)
        val configuredLanguage = configManager.speechLanguage
        val language = if (configuredLanguage.isNotEmpty()) {
            configuredLanguage
        } else {
            Locale.getDefault().toLanguageTag()
        }

        val intent = android.content.Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }

        try {
            speechRecognizer?.startListening(intent)
            Log.d(TAG, "Started speech recognition (language: $language)")
        } catch (e: Exception) {
            Log.e(TAG, "Error starting speech recognition: ${e.message}", e)
            onError?.invoke("Failed to start voice recognition")
        }
    }

    /**
     * Stop speech recognition
     */
    fun stopListening() {
        speechRecognizer?.stopListening()
        isListening = false
        onSpeechEnded?.invoke()
        Log.d(TAG, "Stopped listening")
    }

    /**
     * Check if currently listening
     */
    fun isCurrentlyListening(): Boolean = isListening

    /**
     * Release resources
     */
    fun destroy() {
        speechRecognizer?.destroy()
        speechRecognizer = null
    }

    private fun createRecognitionListener() = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
            Log.d(TAG, "Ready for speech")
            isListening = true
            onSpeechStarted?.invoke()
        }

        override fun onBeginningOfSpeech() {
            Log.d(TAG, "Beginning of speech")
            partialSpeechTextView?.text = "Listening..."
            partialSpeechTextView?.visibility = View.VISIBLE
        }

        override fun onRmsChanged(rmsdB: Float) {
            // Audio level changed - can be used for visual feedback
        }

        override fun onBufferReceived(buffer: ByteArray?) {
            // Audio buffer received
        }

        override fun onEndOfSpeech() {
            Log.d(TAG, "End of speech")
            isListening = false
        }

        override fun onError(error: Int) {
            isListening = false
            onSpeechEnded?.invoke()

            val errorMsg = when (error) {
                SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
                SpeechRecognizer.ERROR_CLIENT -> "Client error"
                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
                SpeechRecognizer.ERROR_NETWORK -> "Network error"
                SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
                SpeechRecognizer.ERROR_NO_MATCH -> "No match found"
                SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognizer busy"
                SpeechRecognizer.ERROR_SERVER -> "Server error"
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech detected"
                else -> "Unknown error"
            }

            if (error != SpeechRecognizer.ERROR_NO_MATCH) {
                Log.e(TAG, "Speech recognition error: $errorMsg")
                onError?.invoke(errorMsg)
            }
        }

        override fun onResults(results: Bundle?) {
            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            if (matches != null && matches.isNotEmpty()) {
                val transcribedText = matches[0]
                Log.d(TAG, "Transcribed text: $transcribedText")

                // Show final result briefly
                partialSpeechTextView?.text = transcribedText
                partialSpeechTextView?.visibility = View.VISIBLE

                // Hide partial speech text after a short delay
                scope.launch {
                    delay(500)
                    partialSpeechTextView?.visibility = View.GONE
                }

                onResults?.invoke(transcribedText)
            }
            isListening = false
            onSpeechEnded?.invoke()
        }

        override fun onPartialResults(partialResults: Bundle?) {
            val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            if (matches != null && matches.isNotEmpty()) {
                val partialText = matches[0]
                partialSpeechTextView?.text = partialText
                partialSpeechTextView?.visibility = View.VISIBLE
                onPartialResults?.invoke(partialText)
            }
        }

        override fun onEvent(eventType: Int, params: Bundle?) {
            // Additional events
        }
    }
}
