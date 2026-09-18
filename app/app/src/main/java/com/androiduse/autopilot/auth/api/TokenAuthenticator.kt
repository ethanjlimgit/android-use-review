package com.androiduse.autopilot.auth.api

import android.util.Log
import com.androiduse.autopilot.auth.SessionManager
import com.google.gson.Gson
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route

/**
 * OkHttp Authenticator that handles 401 responses by attempting to refresh
 * the access token before giving up and signing the user out.
 *
 * Key design:
 * - synchronized block prevents multiple concurrent 401s from each triggering separate refresh calls
 * - X-Token-Refreshed header prevents infinite retry loops
 * - Checks if token was already refreshed by another request (race condition handling)
 * - Separate OkHttpClient for the refresh call avoids circular interceptor issues
 */
class TokenAuthenticator(
    private val sessionManager: SessionManager,
    private val onRefreshFailed: (() -> Unit)?
) : Authenticator {

    companion object {
        private const val TAG = "TokenAuthenticator"
        private const val HEADER_TOKEN_REFRESHED = "X-Token-Refreshed"
    }

    override fun authenticate(route: Route?, response: Response): Request? {
        // Prevent infinite retry loops — if we already retried with a fresh token, give up
        if (response.request.header(HEADER_TOKEN_REFRESHED) != null) {
            Log.w(TAG, "Token refresh already attempted for this request — giving up")
            onRefreshFailed?.invoke()
            return null
        }

        synchronized(this) {
            // Check if another thread already refreshed the token
            val currentToken = sessionManager.getAccessToken()
            val requestToken = response.request.header("Authorization")?.removePrefix("Bearer ")
            if (currentToken != null && currentToken != requestToken) {
                // Token was already refreshed by another request — retry with current token
                Log.d(TAG, "Token already refreshed by another request — retrying")
                return response.request.newBuilder()
                    .header("Authorization", "Bearer $currentToken")
                    .header(HEADER_TOKEN_REFRESHED, "true")
                    .build()
            }

            // Attempt synchronous token refresh
            val refreshToken = sessionManager.getRefreshToken()
            if (refreshToken == null) {
                Log.w(TAG, "No refresh token available — cannot refresh")
                onRefreshFailed?.invoke()
                return null
            }

            return try {
                Log.d(TAG, "Attempting token refresh")
                val refreshResponse = executeRefreshRequest(refreshToken)
                if (refreshResponse != null) {
                    sessionManager.saveAuthToken(refreshResponse.token!!)
                    refreshResponse.user?.let { sessionManager.saveUser(it) }
                    Log.d(TAG, "Token refreshed successfully")

                    response.request.newBuilder()
                        .header("Authorization", "Bearer ${refreshResponse.token.accessToken}")
                        .header(HEADER_TOKEN_REFRESHED, "true")
                        .build()
                } else {
                    Log.w(TAG, "Token refresh returned unsuccessful response")
                    onRefreshFailed?.invoke()
                    null
                }
            } catch (e: Exception) {
                Log.e(TAG, "Token refresh failed with exception", e)
                onRefreshFailed?.invoke()
                null
            }
        }
    }

    /**
     * Execute a synchronous token refresh request.
     * Uses a separate OkHttpClient to avoid circular dependency with RetrofitClient's interceptors.
     */
    private fun executeRefreshRequest(refreshToken: String): AuthResponse? {
        val client = OkHttpClient()
        val gson = Gson()
        val body = gson.toJson(RefreshTokenRequest(refreshToken))
        val request = Request.Builder()
            .url("${RetrofitClient.getBaseUrl()}/api/auth/mobile/refresh")
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()

        val response = client.newCall(request).execute()
        if (!response.isSuccessful) return null

        val responseBody = response.body?.string() ?: return null
        val authResponse = gson.fromJson(responseBody, AuthResponse::class.java)
        return if (authResponse.success) authResponse else null
    }
}
