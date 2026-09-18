package com.androiduse.autopilot.assistant

import android.content.Context
import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService
import android.util.Log

/**
 * VoiceInteractionSessionService implementation for PhoneGPT
 *
 * This service creates VoiceInteractionSession instances when the assistant is triggered
 */
class AndroidUseVoiceInteractionSessionService : VoiceInteractionSessionService() {

    companion object {
        private const val TAG = "AndroidUseSessionService"
    }

    override fun onNewSession(args: Bundle?): VoiceInteractionSession {
        Log.d(TAG, "Creating new VoiceInteractionSession")
        return AndroidUseVoiceInteractionSession(this)
    }
}
