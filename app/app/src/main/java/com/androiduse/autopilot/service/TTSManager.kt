package com.androiduse.autopilot.service

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import com.androiduse.autopilot.core.SingletonHolder
import java.util.*

/**
 * Singleton TextToSpeech manager for AndroidUse
 * Handles speaking task results and other text announcements
 */
class TTSManager private constructor(context: Context) {

    companion object : SingletonHolder<TTSManager, Context>(
        { ctx -> TTSManager(ctx.applicationContext) }
    ) {
        private const val TAG = "TTSManager"
    }

    private var tts: TextToSpeech? = null
    private var isInitialized = false

    init {
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.getDefault()
                isInitialized = true
                Log.d(TAG, "TTS initialized successfully")
            } else {
                Log.e(TAG, "TTS initialization failed")
            }
        }

        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                Log.d(TAG, "TTS started: $utteranceId")
            }

            override fun onDone(utteranceId: String?) {
                Log.d(TAG, "TTS completed: $utteranceId")
            }

            override fun onError(utteranceId: String?) {
                Log.e(TAG, "TTS error: $utteranceId")
            }
        })
    }

    /**
     * Speak the given text
     * @param text Text to speak
     */
    fun speak(text: String) {
        if (!isInitialized) {
            Log.w(TAG, "TTS not initialized, cannot speak: $text")
            return
        }

        if (text.isBlank()) {
            Log.w(TAG, "Attempted to speak empty text")
            return
        }

        tts?.speak(text, TextToSpeech.QUEUE_ADD, null, UUID.randomUUID().toString())
        Log.d(TAG, "Speaking: $text")
    }

    /**
     * Stop current speech
     */
    fun stop() {
        tts?.stop()
        Log.d(TAG, "TTS stopped")
    }

    /**
     * Shutdown TTS engine (use only when cleaning up singleton)
     */
    fun shutdown() {
        tts?.shutdown()
        isInitialized = false
        clearInstance()
        Log.d(TAG, "TTS shutdown")
    }
}
