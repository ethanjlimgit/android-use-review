package com.androiduse.autopilot.auth.api

import android.content.Context
import com.androiduse.autopilot.auth.SessionManager
import com.androiduse.autopilot.config.ConfigManager
import com.google.gson.Gson
import com.google.gson.JsonObject
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {

    private var baseUrl: String = ""
    private var retrofitInstance: Retrofit? = null
    private var apiInstance: AuthApiService? = null
    private var authTokenProvider: (() -> String?)? = null
    private var onUnauthorizedCallback: (() -> Unit)? = null
    private var sessionManager: SessionManager? = null

    fun setBaseUrl(url: String) {
        if (baseUrl != url) {
            baseUrl = url
            // Invalidate cached instances to force recreation with new URL
            retrofitInstance = null
            apiInstance = null
        }
    }

    /**
     * Set base URL and persist it to ConfigManager
     * @param url The backend URL to set
     * @param context Android context for accessing ConfigManager
     */
    fun setBaseUrlAndPersist(url: String, context: Context) {
        setBaseUrl(url)

        // Save to ConfigManager
        val configManager = ConfigManager.Companion.getInstance(context)
        configManager.authServerUrl = url
    }

    /**
     * Set a provider function that returns the current auth token
     * This will be used to automatically add Authorization header to authenticated requests
     */
    fun setAuthTokenProvider(provider: (() -> String?)?) {
        authTokenProvider = provider
        // Invalidate instances to recreate with new interceptor
        retrofitInstance = null
        apiInstance = null
    }

    /**
     * Set a callback to be invoked when token refresh fails after a 401 response.
     * This should trigger the app to sign out the user.
     */
    fun setOnUnauthorizedCallback(callback: (() -> Unit)?) {
        onUnauthorizedCallback = callback
        // Invalidate instances to recreate with new authenticator
        retrofitInstance = null
        apiInstance = null
    }

    /**
     * Set the SessionManager used by the TokenAuthenticator for automatic token refresh on 401.
     * Must be called before making authenticated API requests.
     */
    fun setSessionManager(manager: SessionManager) {
        sessionManager = manager
        // Invalidate instances to recreate with new authenticator
        retrofitInstance = null
        apiInstance = null
    }

    /**
     * Get the current base URL (used by TokenAuthenticator for refresh requests)
     */
    fun getBaseUrl(): String = baseUrl

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val authInterceptor = Interceptor { chain ->
        val originalRequest = chain.request()

        // Add Authorization header if token provider is set and returns a token
        val token = authTokenProvider?.invoke()
        val newRequest = if (token != null) {
            originalRequest.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            originalRequest
        }

        chain.proceed(newRequest)
    }

    private fun getOkHttpClient(): OkHttpClient {
        val builder = OkHttpClient.Builder()
            .addInterceptor(loggingInterceptor)
            .addInterceptor(authInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)

        // Use TokenAuthenticator for automatic token refresh on 401 if SessionManager is available.
        // Falls back to invoking onUnauthorizedCallback directly if SessionManager is not set.
        val sm = sessionManager
        if (sm != null) {
            builder.authenticator(TokenAuthenticator(sm, onUnauthorizedCallback))
        }

        return builder.build()
    }

    private fun getRetrofit(): Retrofit {
        return retrofitInstance ?: Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(getOkHttpClient())
            .addConverterFactory(GsonConverterFactory.create())
            .build().also { retrofitInstance = it }
    }

    val api: AuthApiService
        get() = apiInstance ?: getRetrofit().create(AuthApiService::class.java)
            .also { apiInstance = it }

    /**
     * Parse error message from a failed API response.
     * Extracts 'error' or 'message' field from the JSON error body.
     *
     * @param response The failed Retrofit response
     * @param defaultMessage Fallback message if parsing fails
     * @return The error message from the server, or the default message
     */
    fun <T> parseErrorMessage(response: Response<T>, defaultMessage: String): String {
        return try {
            val errorBody = response.errorBody()?.string()
            if (errorBody.isNullOrBlank()) {
                return defaultMessage
            }

            val gson = Gson()
            val jsonObject = gson.fromJson(errorBody, JsonObject::class.java)

            // Try to get 'error' field first, then 'message'
            jsonObject?.get("error")?.asString
                ?: jsonObject?.get("message")?.asString
                ?: defaultMessage
        } catch (e: Exception) {
            android.util.Log.w("RetrofitClient", "Failed to parse error body: ${e.message}")
            defaultMessage
        }
    }
}
