package com.androiduse.autopilot.config

import android.content.Context
import android.speech.SpeechRecognizer
import android.util.Log

/**
 * Helper class for speech recognition configuration
 * Uses cloud-based recognition for better accuracy
 */
object SpeechRecognitionConfig {

    private const val TAG = "SpeechRecognitionConfig"

    /**
     * Check if speech recognition is available on this device
     */
    fun isAvailable(context: Context): Boolean {
        return SpeechRecognizer.isRecognitionAvailable(context)
    }

    /**
     * Get a description of the current mode
     */
    fun getCurrentModeDescription(context: Context): String {
        return if (isAvailable(context)) {
            "Cloud-based recognition"
        } else {
            "Speech recognition not available"
        }
    }

    /**
     * Log current configuration
     */
    fun logConfiguration(context: Context) {
        Log.i(TAG, "Speech recognition: ${getCurrentModeDescription(context)}")
    }
}
