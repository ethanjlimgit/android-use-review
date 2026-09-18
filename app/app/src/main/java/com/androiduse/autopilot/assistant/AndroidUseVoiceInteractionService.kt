package com.androiduse.autopilot.assistant

import android.service.voice.VoiceInteractionService
import android.util.Log

/**
 * VoiceInteractionService implementation for PhoneGPT digital assistant
 *
 * This service allows PhoneGPT to be set as the default digital assistant
 * and respond to system assistant triggers (long-press home, voice activation, etc.)
 */
class AndroidUseVoiceInteractionService : VoiceInteractionService() {

    companion object {
        private const val TAG = "AndroidUseVoiceInteractionService"
    }

    override fun onReady() {
        super.onReady()
        Log.d(TAG, "VoiceInteractionService is ready")
    }

    override fun onShutdown() {
        super.onShutdown()
        Log.d(TAG, "VoiceInteractionService shutdown")
    }
}
