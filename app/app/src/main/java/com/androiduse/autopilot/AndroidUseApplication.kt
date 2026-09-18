package com.androiduse.autopilot

import android.app.Application
import android.util.Log
import com.androiduse.autopilot.analytics.AnalyticsManager
import com.androiduse.autopilot.auth.SessionManager
import com.androiduse.autopilot.auth.api.RetrofitClient
import com.androiduse.autopilot.config.ConfigManager
import com.androiduse.autopilot.BuildConfig
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig

class AndroidUseApplication : Application() {

    companion object {
        private const val TAG = "AndroidUseApp"
        const val POSTHOG_API_KEY = "phc_wb6tgGcwC9geMizAP3MyUc6n64n8HcMhTcI9b3bSwjU"
        const val POSTHOG_HOST = "https://us.i.posthog.com"
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "AndroidUse Application starting")

        // Initialize PostHog
        val config = PostHogAndroidConfig(
            apiKey = POSTHOG_API_KEY,
            host = POSTHOG_HOST
        )
        // Enable debug mode in debug builds to see what's happening in logcat
        config.debug = BuildConfig.DEBUG

        PostHogAndroid.setup(this, config)
        Log.d(TAG, "PostHog initialized with debug=${BuildConfig.DEBUG}")

        // Send a test event after a short delay to verify PostHog is working
        if (BuildConfig.DEBUG) {
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                AnalyticsManager.captureWithContext("app_started", mapOf(
                    "test" to true
                ))
                Log.d(TAG, "PostHog test event sent - check dashboard for 'app_started' event")
            }, 2000) // Wait 2 seconds for PostHog to initialize
        }

        // Initialize backend URL from saved preferences
        initializeBackendUrl()
    }

    /**
     * Initialize RetrofitClient with saved backend URL from ConfigManager
     */
    private fun initializeBackendUrl() {
        val configManager = ConfigManager.Companion.getInstance(this)

        // Force correct environment for production/staging builds
        val buildEnvironment = BuildConfig.DEFAULT_ENVIRONMENT
        if (buildEnvironment == "production" || buildEnvironment == "staging") {
            // Always use BuildConfig values for prod/staging builds
            val authUrl = BuildConfig.DEFAULT_AUTH_URL
            val wsHost = BuildConfig.DEFAULT_WS_HOST
            val wsPort = BuildConfig.DEFAULT_WS_PORT

            configManager.serverEnvironment = buildEnvironment
            configManager.authServerUrl = authUrl
            configManager.backendWsHost = wsHost
            configManager.backendWsPort = wsPort
            configManager.backendWsEnabled = true

            RetrofitClient.setBaseUrl(authUrl)
            Log.d(TAG, "Forced $buildEnvironment environment: URL=$authUrl, wsHost=$wsHost:$wsPort")
        } else {
            // Dev builds: use saved preferences or BuildConfig defaults
            val savedUrl = configManager.authServerUrl

            if (savedUrl.isNotEmpty()) {
                RetrofitClient.setBaseUrl(savedUrl)
                Log.d(TAG, "Backend URL initialized from preferences: $savedUrl")
            } else {
                // Use default from BuildConfig if no saved URL
                RetrofitClient.setBaseUrl(BuildConfig.DEFAULT_AUTH_URL)
                configManager.authServerUrl = BuildConfig.DEFAULT_AUTH_URL
                Log.d(TAG, "Backend URL initialized with default: ${BuildConfig.DEFAULT_AUTH_URL}")
            }
        }

        // Set up auth token provider for automatic header injection
        val sessionManager = SessionManager(this)
        RetrofitClient.setAuthTokenProvider {
            sessionManager.getAccessToken()
        }
    }
}
