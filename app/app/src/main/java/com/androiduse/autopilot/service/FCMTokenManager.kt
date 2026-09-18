package com.androiduse.autopilot.service

import android.content.Context
import android.provider.Settings
import android.util.Log
import com.androiduse.autopilot.auth.SessionManager
import com.androiduse.autopilot.auth.api.FCMTokenRequest
import com.androiduse.autopilot.auth.api.RetrofitClient
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/**
 * Utility object to manage FCM token registration with the backend
 */
object FCMTokenManager {
    private const val TAG = "FCMTokenManager"
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    /**
     * Register FCM token with backend if user is authenticated
     * 
     * This should be called:
     * 1. When a new token is generated (onNewToken callback)
     * 2. After successful authentication (sign-in/sign-up)
     * 3. On app startup if user is already authenticated
     */
    fun registerTokenIfAuthenticated(context: Context) {
        scope.launch {
            try {
                val sessionManager = SessionManager(context)
                
                // Check if user is authenticated
                if (!sessionManager.isAuthenticated()) {
                    Log.d(TAG, "User not authenticated, skipping FCM token registration")
                    return@launch
                }

                // Get current FCM token
                val token = FirebaseMessaging.getInstance().token.await()
                Log.d(TAG, "Retrieved FCM token: ${token.take(20)}...")

                // Get auth token for API request
                val authToken = sessionManager.getAuthToken()
                if (authToken == null) {
                    Log.w(TAG, "Auth token is null, cannot register FCM token")
                    return@launch
                }

                // Get Android ID as device ID
                val deviceId = Settings.Secure.getString(
                    context.contentResolver,
                    Settings.Secure.ANDROID_ID
                ) ?: "unknown"

                // Set auth token provider for RetrofitClient
                RetrofitClient.setAuthTokenProvider {
                    sessionManager.getAuthToken()?.accessToken
                }

                // Register token with backend
                val apiService = RetrofitClient.api
                val request = FCMTokenRequest(fcmToken = token, deviceId = deviceId)
                val response = apiService.registerFCMToken(request)

                if (response.isSuccessful) {
                    val responseBody = response.body()
                    if (responseBody?.success == true) {
                        Log.i(TAG, "FCM token successfully registered with backend: ${responseBody.message}")
                    } else {
                        Log.e(TAG, "FCM token registration failed: ${responseBody?.error}")
                    }
                } else {
                    Log.e(TAG, "FCM token registration failed with code: ${response.code()}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to register FCM token with backend", e)
            }
        }
    }

    /**
     * Register a specific FCM token with backend if user is authenticated
     * 
     * Use this when you already have the token (e.g., from onNewToken callback)
     */
    fun registerToken(context: Context, token: String) {
        scope.launch {
            try {
                val sessionManager = SessionManager(context)
                
                // Check if user is authenticated
                if (!sessionManager.isAuthenticated()) {
                    Log.d(TAG, "User not authenticated, skipping FCM token registration")
                    return@launch
                }

                Log.d(TAG, "Registering FCM token: ${token.take(20)}...")

                // Get auth token for API request
                val authToken = sessionManager.getAuthToken()
                if (authToken == null) {
                    Log.w(TAG, "Auth token is null, cannot register FCM token")
                    return@launch
                }

                // Get Android ID as device ID
                val deviceId = Settings.Secure.getString(
                    context.contentResolver,
                    Settings.Secure.ANDROID_ID
                ) ?: "unknown"

                // Set auth token provider for RetrofitClient
                RetrofitClient.setAuthTokenProvider {
                    sessionManager.getAuthToken()?.accessToken
                }

                // Register token with backend
                val apiService = RetrofitClient.api
                val request = FCMTokenRequest(fcmToken = token, deviceId = deviceId)
                val response = apiService.registerFCMToken(request)

                if (response.isSuccessful) {
                    val responseBody = response.body()
                    if (responseBody?.success == true) {
                        Log.i(TAG, "FCM token successfully registered with backend: ${responseBody.message}")
                    } else {
                        Log.e(TAG, "FCM token registration failed: ${responseBody?.error}")
                    }
                } else {
                    Log.e(TAG, "FCM token registration failed with code: ${response.code()}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to register FCM token with backend", e)
            }
        }
    }
}

