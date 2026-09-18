package com.androiduse.autopilot.assistant

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.service.voice.VoiceInteractionSession
import android.util.Log
import android.view.View
import android.widget.Toast
import com.androiduse.autopilot.service.FloatingButtonService
import com.androiduse.autopilot.ui.MainActivity

/**
 * VoiceInteractionSession implementation for PhoneGPT assistant
 *
 * This handles the actual interaction when the assistant is triggered
 * (via long-press home, voice activation, etc.)
 */
class AndroidUseVoiceInteractionSession(context: Context) : VoiceInteractionSession(context) {

    companion object {
        private const val TAG = "AndroidUseSession"
    }

    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        Log.d(TAG, "Assistant session shown with flags: $showFlags")

        // Check if overlay permission is granted
        val hasOverlayPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(context)
        } else {
            true
        }

        if (hasOverlayPermission) {
            // Start FloatingButtonService to show the voice control overlay
            val serviceIntent = Intent(context, FloatingButtonService::class.java).apply {
                putExtra(FloatingButtonService.EXTRA_FROM_ASSISTANT, true)
            }
            try {
                context.startService(serviceIntent)
                Log.d(TAG, "Started FloatingButtonService from assistant trigger")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start FloatingButtonService", e)
                // Fallback to MainActivity if service fails
                launchMainActivity()
            }
        } else {
            // No overlay permission - open MainActivity to guide user
            Log.w(TAG, "Overlay permission not granted, opening MainActivity")
            Toast.makeText(
                context,
                "Please grant overlay permission to use voice control",
                Toast.LENGTH_LONG
            ).show()
            launchMainActivity()
        }

        // Hide the assistant UI since we're launching our own interface
        hide()
    }

    private fun launchMainActivity() {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        context.startActivity(intent)
    }

    override fun onHide() {
        super.onHide()
        Log.d(TAG, "Assistant session hidden")
    }

    override fun onHandleAssist(
        data: Bundle?,
        structure: android.app.assist.AssistStructure?,
        content: android.app.assist.AssistContent?
    ) {
        super.onHandleAssist(data, structure, content)
        Log.d(TAG, "Assistant triggered with assist data")
    }

    override fun onHandleAssistSecondary(
        data: Bundle?,
        structure: android.app.assist.AssistStructure?,
        content: android.app.assist.AssistContent?,
        index: Int,
        count: Int
    ) {
        super.onHandleAssistSecondary(data, structure, content, index, count)
        Log.d(TAG, "Secondary assist data received")
    }
}
