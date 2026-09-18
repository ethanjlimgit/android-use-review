package com.androiduse.autopilot.assistant

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.util.Log

/**
 * Manager for checking and enabling PhoneGPT as the default digital assistant
 */
object AssistantManager {

    private const val TAG = "AssistantManager"

    /**
     * Check if PhoneGPT is set as the default assistant
     */
    fun isDefaultAssistant(context: Context): Boolean {
        return try {
            val assistComponent = Settings.Secure.getString(
                context.contentResolver,
                "assistant"
            )
            val voiceInteractionComponent = Settings.Secure.getString(
                context.contentResolver,
                "voice_interaction_service"
            )

            val ourComponentName = ComponentName(
                context,
                AndroidUseVoiceInteractionService::class.java
            ).flattenToString()

            val ourPackageName = context.packageName

            // Check if our VoiceInteractionService is set
            val isVoiceInteractionSet = voiceInteractionComponent?.let { component ->
                component == ourComponentName || component.startsWith(ourPackageName)
            } ?: false

            // Check if our assistant is set (this might be null if only VoiceInteractionService is set)
            val isAssistSet = assistComponent?.let { component ->
                component == ourComponentName || component.startsWith(ourPackageName)
            } ?: false

            val isDefault = isVoiceInteractionSet || isAssistSet

            Log.d(TAG, "=== Default Assistant Status ===")
            Log.d(TAG, "Is default assistant: $isDefault")
            Log.d(TAG, "Assistant component: $assistComponent")
            Log.d(TAG, "Voice interaction component: $voiceInteractionComponent")
            Log.d(TAG, "Our component name: $ourComponentName")
            Log.d(TAG, "Our package name: $ourPackageName")
            Log.d(TAG, "Voice interaction match: $isVoiceInteractionSet")
            Log.d(TAG, "Assistant match: $isAssistSet")

            isDefault
        } catch (e: Exception) {
            Log.e(TAG, "Error checking default assistant status", e)
            false
        }
    }

    /**
     * Open system settings to allow user to set PhoneGPT as default assistant
     */
    fun openAssistantSettings(context: Context) {
        try {
            // Try to open the default assistant settings (Android 6.0+)
            // This opens the "Assist & voice input" page where users can select default assistant
            val intent = Intent("android.settings.VOICE_INPUT_SETTINGS").apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            Log.d(TAG, "Opened voice input settings")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open voice input settings, trying fallback", e)
            try {
                // Fallback to the standard Settings.ACTION_VOICE_INPUT_SETTINGS constant
                val intent = Intent(Settings.ACTION_VOICE_INPUT_SETTINGS).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
                Log.d(TAG, "Opened voice input settings via fallback")
            } catch (e2: Exception) {
                Log.e(TAG, "Failed to open voice input settings fallback, trying general settings", e2)
                try {
                    // Last resort: open general settings
                    val intent = Intent(Settings.ACTION_SETTINGS).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    context.startActivity(intent)
                    Log.d(TAG, "Opened general settings")
                } catch (e3: Exception) {
                    Log.e(TAG, "Failed to open any settings", e3)
                }
            }
        }
    }

    /**
     * Get the name of the current default assistant
     */
    fun getCurrentAssistantName(context: Context): String? {
        return try {
            val assistComponent = Settings.Secure.getString(
                context.contentResolver,
                "assistant"
            )
            assistComponent?.substringAfterLast('/')?.substringBefore('@')
        } catch (e: Exception) {
            Log.e(TAG, "Error getting current assistant name", e)
            null
        }
    }
}
