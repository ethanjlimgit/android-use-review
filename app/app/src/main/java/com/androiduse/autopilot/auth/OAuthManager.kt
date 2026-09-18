package com.androiduse.autopilot.auth

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.activity.result.ActivityResultLauncher
import com.androiduse.autopilot.BuildConfig
import com.androiduse.autopilot.auth.api.OAuthCodeRequest
import com.androiduse.autopilot.auth.api.RetrofitClient
import com.androiduse.autopilot.auth.model.AuthResult
import com.androiduse.autopilot.config.ConfigManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import net.openid.appauth.*

class OAuthManager(
    private val context: Context,
    private val sessionManager: SessionManager
) {
    companion object {
        private const val TAG = "OAuthManager"
        private const val REDIRECT_URI = "androiduse.autopilot://oauth/callback"

        // GitHub OAuth Configuration
        // Configured per build flavor (dev/staging/production) in BuildConfig
        private const val GITHUB_AUTH_ENDPOINT = "https://github.com/login/oauth/authorize"
        private const val GITHUB_TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token"

        // Twitter OAuth Configuration (OAuth 2.0 with PKCE)
        // Configured per build flavor (dev/staging/production) in BuildConfig
        private const val TWITTER_AUTH_ENDPOINT = "https://twitter.com/i/oauth2/authorize"
        private const val TWITTER_TOKEN_ENDPOINT = "https://api.twitter.com/2/oauth2/token"
    }

    private var authorizationService: AuthorizationService? = null
    private var currentProvider: OAuthProvider? = null
    private var codeVerifier: String? = null

    enum class OAuthProvider {
        GITHUB,
        TWITTER
    }

    /**
     * Initialize OAuth sign-in flow
     */
    fun initiateOAuthFlow(
        provider: OAuthProvider,
        activityResultLauncher: ActivityResultLauncher<Intent>
    ) {
        currentProvider = provider

        val serviceConfig = when (provider) {
            OAuthProvider.GITHUB -> createGitHubServiceConfig()
            OAuthProvider.TWITTER -> createTwitterServiceConfig()
        }

        val authRequest = createAuthorizationRequest(serviceConfig, provider)

        authorizationService = AuthorizationService(context)
        val authIntent = authorizationService!!.getAuthorizationRequestIntent(authRequest)

        Log.d(TAG, "Initiating OAuth flow for $provider")
        activityResultLauncher.launch(authIntent)
    }

    /**
     * Handle OAuth callback
     */
    suspend fun handleOAuthCallback(intent: Intent): AuthResult = withContext(Dispatchers.IO) {
        try {
            val response = AuthorizationResponse.fromIntent(intent)
            val exception = AuthorizationException.fromIntent(intent)

            if (exception != null) {
                Log.e(TAG, "OAuth authorization failed", exception)
                return@withContext AuthResult.Error(
                    message = "OAuth authorization failed: ${exception.message}",
                    exception = exception
                )
            }

            if (response == null) {
                return@withContext AuthResult.Error(message = "No authorization response received")
            }

            val authCode = response.authorizationCode
            if (authCode == null) {
                return@withContext AuthResult.Error(message = "No authorization code received")
            }

            Log.d(TAG, "Authorization code received: ${authCode.take(10)}...")

            // Exchange code with backend
            exchangeOAuthCodeWithBackend(authCode, currentProvider!!)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle OAuth callback", e)
            AuthResult.Error(
                message = "Failed to complete OAuth flow: ${e.message}",
                exception = e
            )
        }
    }

    /**
     * Exchange OAuth code with backend for session JWT
     */
    private suspend fun exchangeOAuthCodeWithBackend(
        code: String,
        provider: OAuthProvider
    ): AuthResult {
        return try {
            val providerName = when (provider) {
                OAuthProvider.GITHUB -> "github"
                OAuthProvider.TWITTER -> "twitter"
            }

            val request = OAuthCodeRequest(
                code = code,
                provider = providerName,
                redirectUri = REDIRECT_URI,
                codeVerifier = codeVerifier
            )

            val response = RetrofitClient.api.exchangeOAuthCode(request)

            if (response.isSuccessful && response.body()?.success == true) {
                val authResponse = response.body()!!
                val token = authResponse.token!!
                val user = authResponse.user!!

                // Save to session
                sessionManager.saveAuthToken(token)
                sessionManager.saveUser(user)

                // Set deviceId in ConfigManager after authentication
                val configManager = ConfigManager.Companion.getInstance(context)
                authResponse.device?.id?.let { configManager.deviceId = it }
                // Sync survey completion status from backend
                configManager.isSurveyComplete = user.surveyCompleted

                Log.d(TAG, "Successfully authenticated user: ${user.email}, surveyCompleted: ${user.surveyCompleted}")
                AuthResult.Success(token = token, user = user)
            } else {
                // Parse error message from error body (response.body() is null for error responses)
                val errorMessage = RetrofitClient.parseErrorMessage(response, "Authentication failed")
                Log.e(TAG, "Backend authentication failed: $errorMessage")
                AuthResult.Error(message = errorMessage)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Code exchange failed", e)
            AuthResult.Error(
                message = "Failed to authenticate with backend: ${e.message}",
                exception = e
            )
        }
    }

    /**
     * Create GitHub service configuration
     */
    private fun createGitHubServiceConfig(): AuthorizationServiceConfiguration {
        return AuthorizationServiceConfiguration(
            Uri.parse(GITHUB_AUTH_ENDPOINT),
            Uri.parse(GITHUB_TOKEN_ENDPOINT)
        )
    }

    /**
     * Create Twitter service configuration
     */
    private fun createTwitterServiceConfig(): AuthorizationServiceConfiguration {
        return AuthorizationServiceConfiguration(
            Uri.parse(TWITTER_AUTH_ENDPOINT),
            Uri.parse(TWITTER_TOKEN_ENDPOINT)
        )
    }

    /**
     * Create authorization request
     */
    private fun createAuthorizationRequest(
        serviceConfig: AuthorizationServiceConfiguration,
        provider: OAuthProvider
    ): AuthorizationRequest {
        val clientId = when (provider) {
            OAuthProvider.GITHUB -> BuildConfig.GITHUB_CLIENT_ID
            OAuthProvider.TWITTER -> BuildConfig.TWITTER_CLIENT_ID
        }

        val builder = AuthorizationRequest.Builder(
            serviceConfig,
            clientId,
            ResponseTypeValues.CODE,
            Uri.parse(REDIRECT_URI)
        )

        // Add scopes based on provider
        when (provider) {
            OAuthProvider.GITHUB -> {
                builder.setScopes("user:email", "read:user")
            }
            OAuthProvider.TWITTER -> {
                builder.setScopes("tweet.read", "users.read")
                // Twitter requires PKCE
                val pkce = CodeVerifierUtil.generateRandomCodeVerifier()
                codeVerifier = pkce
                builder.setCodeVerifier(pkce)
            }
        }

        return builder.build()
    }

    /**
     * Sign out
     */
    fun signOut() {
        sessionManager.clearSession()

        // Reset task limit for new user
        val configManager = ConfigManager.Companion.getInstance(context)
        configManager.resetTaskLimitForNewUser()

        currentProvider = null
        codeVerifier = null
    }

    /**
     * Dispose resources
     */
    fun dispose() {
        authorizationService?.dispose()
        authorizationService = null
    }
}
