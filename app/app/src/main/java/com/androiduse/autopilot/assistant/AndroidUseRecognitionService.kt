package com.androiduse.autopilot.assistant

import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionService
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log

/**
 * RecognitionService implementation for PhoneGPT
 *
 * This service makes PhoneGPT appear as a voice input option in system settings
 * and allows it to be used for voice recognition across the system.
 */
class AndroidUseRecognitionService : RecognitionService() {

    companion object {
        private const val TAG = "AndroidUseRecognitionService"
    }

    private var callback: Callback? = null

    override fun onStartListening(recognizerIntent: Intent?, listener: Callback?) {
        Log.d(TAG, "onStartListening called")
        callback = listener

        try {
            // Get recognition parameters
            val language = recognizerIntent?.getStringExtra(RecognizerIntent.EXTRA_LANGUAGE)
            val maxResults = recognizerIntent?.getIntExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1) ?: 1

            Log.d(TAG, "Recognition requested - language: $language, maxResults: $maxResults")

            // Signal that we're ready to listen
            listener?.readyForSpeech(Bundle())

            // For now, we'll indicate that we don't support on-device recognition
            // and redirect to the main app for voice input
            listener?.error(SpeechRecognizer.ERROR_NO_MATCH)

            // Alternative: Launch MainActivity for voice input
            // This allows users to use PhoneGPT's full voice interface
            // Uncomment if you want to launch the app instead of showing an error
            /*
            val intent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            startActivity(intent)
            listener?.error(SpeechRecognizer.ERROR_CLIENT)
            */

        } catch (e: Exception) {
            Log.e(TAG, "Error starting recognition", e)
            listener?.error(SpeechRecognizer.ERROR_CLIENT)
        }
    }

    override fun onCancel(listener: Callback?) {
        Log.d(TAG, "onCancel called")
        callback = null
    }

    override fun onStopListening(listener: Callback?) {
        Log.d(TAG, "onStopListening called")
        callback = null
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "Service destroyed")
        callback = null
    }
}
