package com.androiduse.autopilot.auth

import android.app.Activity
import android.app.Application
import android.content.Intent
import android.util.Log
import androidx.activity.result.ActivityResultLauncher
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.androiduse.autopilot.analytics.AnalyticsManager
import com.androiduse.autopilot.auth.api.RefreshTokenRequest
import com.androiduse.autopilot.auth.api.RetrofitClient
import com.androiduse.autopilot.auth.model.AuthResult
import com.androiduse.autopilot.auth.model.User
import com.androiduse.autopilot.config.ConfigManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class AuthViewModel(application: Application) : AndroidViewModel(application) {

    companion object {
        private const val TAG = "AuthViewModel"
    }

    private val sessionManager = SessionManager(application)

    private lateinit var googleAuthManager: GoogleAuthManager
    private lateinit var oAuthManager: OAuthManager
    private lateinit var emailPasswordAuthManager: EmailPasswordAuthManager

    private val _authState = MutableStateFlow<AuthResult>(AuthResult.NotAuthenticated)
    val authState: StateFlow<AuthResult> = _authState

    private val _currentUser = MutableStateFlow<User?>(null)
    val currentUser: StateFlow<User?> = _currentUser

    // Referral code from deep link
    private var pendingReferralCode: String? = null

    init {
        initializeManagers()
        setupUnauthorizedCallback()
        checkExistingSession()
    }

    /**
     * Set referral code from deep link
     */
    fun setReferralCode(code: String) {
        pendingReferralCode = code
        Log.d(TAG, "Referral code set: $code")
    }

    /**
     * Get current referral code (if any)
     */
    fun getReferralCode(): String? = pendingReferralCode

    /**
     * Clear referral code after successful signup
     */
    private fun clearReferralCode() {
        pendingReferralCode = null
    }

    /**
     * Setup callback for automatic sign-out on unauthorized responses.
     * Also provides SessionManager to RetrofitClient so the TokenAuthenticator
     * can attempt a token refresh before falling back to sign-out.
     */
    private fun setupUnauthorizedCallback() {
        RetrofitClient.setSessionManager(sessionManager)
        RetrofitClient.setOnUnauthorizedCallback {
            Log.w(TAG, "Token refresh failed - signing out")
            signOut()
        }
    }

    /**
     * Initialize authentication managers
     */
    private fun initializeManagers() {
        googleAuthManager = GoogleAuthManager(
            context = getApplication(),
            sessionManager = sessionManager
        )

        oAuthManager = OAuthManager(
            context = getApplication(),
            sessionManager = sessionManager
        )

        emailPasswordAuthManager = EmailPasswordAuthManager(
            context = getApplication(),
            sessionManager = sessionManager
        )
    }

    /**
     * Check if user has an existing valid session
     */
    private fun checkExistingSession() {
        if (sessionManager.isAuthenticated()) {
            val user = sessionManager.getUser()
            _currentUser.value = user
            _authState.value = if (user != null) {
                val token = sessionManager.getAuthToken()!!

                // Sync survey completion status from stored user
                val configManager = ConfigManager.Companion.getInstance(getApplication())
                configManager.isSurveyComplete = user.surveyCompleted

                AuthResult.Success(token = token, user = user)
            } else {
                AuthResult.NotAuthenticated
            }
            Log.d(TAG, "Existing session found for user: ${user?.email}, surveyCompleted: ${user?.surveyCompleted}")
        } else {
            Log.d(TAG, "No existing session found")
        }
    }

    /**
     * Configure backend URL and persist to preferences
     */
    fun setBackendUrl(url: String) {
        RetrofitClient.setBaseUrlAndPersist(url, getApplication())
    }

    /**
     * Set callback for legacy Google Sign-In flow
     * This is called when modern Credential Manager fails
     */
    fun setLegacySignInCallback(callback: (Intent) -> Unit) {
        googleAuthManager.onLegacySignInRequired = callback
    }

    /**
     * Sign in with Google
     * @param activity Activity context required for Credential Manager to display account picker
     */
    fun signInWithGoogle(activity: Activity) {
        viewModelScope.launch {
            _authState.value = AuthResult.Loading
            Log.d(TAG, "Initiating Google sign in")

            // Set the activity context for Credential Manager
            googleAuthManager.setActivityContext(activity)

            // Pass referral code if present
            googleAuthManager.setReferralCode(pendingReferralCode)

            val result = googleAuthManager.signInWithGoogle()
            _authState.value = result

            if (result is AuthResult.Success) {
                _currentUser.value = result.user
                Log.d(TAG, "Google sign in successful: ${result.user.email}")
                clearReferralCode() // Clear referral code after successful signup

                // Track sign in event
                AnalyticsManager.capture(
                    event = "user_signed_in",
                    properties = mapOf(
                        "provider" to "google",
                        "email" to (result.user.email ?: "unknown"),
                        "referral_code" to (pendingReferralCode ?: "none")
                    )
                )

                // Identify user
                AnalyticsManager.identify(
                    userId = result.user.id,
                    properties = mapOf(
                        "email" to (result.user.email ?: "unknown"),
                        "name" to (result.user.name ?: "")
                    )
                )
            } else if (result is AuthResult.Error) {
                Log.e(TAG, "Google sign in failed: ${result.message}")
            }
        }
    }

    /**
     * Handle legacy Google Sign-In result
     * Call this from ActivityResultLauncher callback
     */
    fun handleLegacyGoogleSignInResult(data: Intent?) {
        viewModelScope.launch {
            Log.d(TAG, "Processing legacy Google sign in result")
            _authState.value = AuthResult.Loading

            val result = googleAuthManager.handleLegacySignInResult(data)
            _authState.value = result

            if (result is AuthResult.Success) {
                _currentUser.value = result.user
                Log.d(TAG, "Legacy Google sign in successful: ${result.user.email}")

                // Track sign in event with legacy flag
                AnalyticsManager.capture(
                    event = "user_signed_in",
                    properties = mapOf(
                        "provider" to "google",
                        "method" to "legacy_fallback",
                        "email" to (result.user.email ?: "unknown")
                    )
                )

                // Identify user
                AnalyticsManager.identify(
                    userId = result.user.id,
                    properties = mapOf(
                        "email" to (result.user.email ?: "unknown"),
                        "name" to (result.user.name ?: "")
                    )
                )
            } else if (result is AuthResult.Error) {
                Log.e(TAG, "Legacy Google sign in failed: ${result.message}")
            }
        }
    }

    /**
     * Sign in with GitHub
     */
    fun signInWithGitHub(activityResultLauncher: ActivityResultLauncher<Intent>) {
        _authState.value = AuthResult.Loading
        Log.d(TAG, "Initiating GitHub sign in")
        oAuthManager.initiateOAuthFlow(
            provider = OAuthManager.OAuthProvider.GITHUB,
            activityResultLauncher = activityResultLauncher
        )
    }

    /**
     * Sign in with Twitter
     */
    fun signInWithTwitter(activityResultLauncher: ActivityResultLauncher<Intent>) {
        _authState.value = AuthResult.Loading
        Log.d(TAG, "Initiating Twitter sign in")
        oAuthManager.initiateOAuthFlow(
            provider = OAuthManager.OAuthProvider.TWITTER,
            activityResultLauncher = activityResultLauncher
        )
    }

    /**
     * Handle OAuth callback from deep link
     */
    fun handleOAuthCallback(intent: Intent) {
        viewModelScope.launch {
            Log.d(TAG, "Handling OAuth callback")
            val result = oAuthManager.handleOAuthCallback(intent)
            _authState.value = result

            if (result is AuthResult.Success) {
                _currentUser.value = result.user
                Log.d(TAG, "OAuth sign in successful: ${result.user.email}")

                // Track sign in event (provider determined by which method initiated OAuth)
                val provider = when {
                    intent.data?.toString()?.contains("github") == true -> "github"
                    intent.data?.toString()?.contains("twitter") == true -> "twitter"
                    else -> "oauth"
                }

                AnalyticsManager.capture(
                    event = "user_signed_in",
                    properties = mapOf(
                        "provider" to provider,
                        "email" to (result.user.email ?: "unknown")
                    )
                )

                // Identify user
                AnalyticsManager.identify(
                    userId = result.user.id,
                    properties = mapOf(
                        "email" to (result.user.email ?: "unknown"),
                        "name" to (result.user.name ?: "")
                    )
                )
            } else if (result is AuthResult.Error) {
                Log.e(TAG, "OAuth sign in failed: ${result.message}")
            }
        }
    }

    /**
     * Sign up with email and password
     */
    fun signUpWithEmail(email: String, password: String, name: String? = null) {
        viewModelScope.launch {
            _authState.value = AuthResult.Loading
            Log.d(TAG, "Initiating email/password sign up")

            val result = emailPasswordAuthManager.signUp(email, password, name, pendingReferralCode)
            _authState.value = result

            if (result is AuthResult.Success) {
                _currentUser.value = result.user
                Log.d(TAG, "Email sign up successful: ${result.user.email}")
                clearReferralCode() // Clear referral code after successful signup

                // Track sign up event
                AnalyticsManager.capture(
                    event = "user_signed_up",
                    properties = mapOf(
                        "provider" to "email",
                        "email" to (result.user.email ?: "unknown"),
                        "referral_code" to (pendingReferralCode ?: "none")
                    )
                )

                // Identify user
                AnalyticsManager.identify(
                    userId = result.user.id,
                    properties = mapOf(
                        "email" to (result.user.email ?: "unknown"),
                        "name" to (result.user.name ?: "")
                    )
                )
            } else if (result is AuthResult.Error) {
                Log.e(TAG, "Email sign up failed: ${result.message}")
            }
        }
    }

    /**
     * Sign in with email and password
     */
    fun signInWithEmail(email: String, password: String) {
        viewModelScope.launch {
            _authState.value = AuthResult.Loading
            Log.d(TAG, "Initiating email/password sign in")

            val result = emailPasswordAuthManager.signIn(email, password)
            _authState.value = result

            if (result is AuthResult.Success) {
                _currentUser.value = result.user
                Log.d(TAG, "Email sign in successful: ${result.user.email}")

                // Track sign in event
                AnalyticsManager.capture(
                    event = "user_signed_in",
                    properties = mapOf(
                        "provider" to "email",
                        "email" to (result.user.email ?: "unknown")
                    )
                )

                // Identify user
                AnalyticsManager.identify(
                    userId = result.user.id,
                    properties = mapOf(
                        "email" to (result.user.email ?: "unknown"),
                        "name" to (result.user.name ?: "")
                    )
                )
            } else if (result is AuthResult.Error) {
                Log.e(TAG, "Email sign in failed: ${result.message}")
            }
        }
    }

    /**
     * Resend email verification link
     */
    fun resendVerificationEmail(email: String) {
        viewModelScope.launch {
            _authState.value = AuthResult.Loading
            Log.d(TAG, "Resending verification email")

            val result = emailPasswordAuthManager.resendVerificationEmail(email)
            _authState.value = result

            if (result is AuthResult.SignUpPending) {
                Log.d(TAG, "Verification email resent successfully")

                // Track verification email resent event
                AnalyticsManager.capture(
                    event = "verification_email_resent",
                    properties = mapOf(
                        "email" to email
                    )
                )
            } else if (result is AuthResult.Error) {
                Log.e(TAG, "Verification email resend failed: ${result.message}")
            }
        }
    }

    /**
     * Request password reset link
     */
    fun forgotPassword(email: String) {
        viewModelScope.launch {
            _authState.value = AuthResult.Loading
            Log.d(TAG, "Requesting password reset")

            val result = emailPasswordAuthManager.forgotPassword(email)
            _authState.value = result

            if (result is AuthResult.SignUpPending) {
                Log.d(TAG, "Password reset email sent successfully")

                // Track password reset event
                AnalyticsManager.capture(
                    event = "password_reset_requested",
                    properties = mapOf(
                        "email" to email
                    )
                )
            } else if (result is AuthResult.Error) {
                Log.e(TAG, "Password reset failed: ${result.message}")
            }
        }
    }

    /**
     * Validate email format
     */
    fun validateEmail(email: String) = emailPasswordAuthManager.validateEmail(email)

    /**
     * Validate password strength
     */
    fun validatePassword(password: String) = emailPasswordAuthManager.validatePassword(password)

    /**
     * Sign out current user
     */
    fun signOut() {
        Log.d(TAG, "Signing out user: ${_currentUser.value?.email}")

        // Track sign out event before clearing user data
        AnalyticsManager.capture(
            event = "user_signed_out",
            properties = mapOf(
                "email" to (_currentUser.value?.email ?: "unknown")
            )
        )

        googleAuthManager.signOut()
        oAuthManager.signOut()
        emailPasswordAuthManager.signOut()

        // Clear deviceId from ConfigManager on sign out
        val configManager = ConfigManager.Companion.getInstance(getApplication())
        configManager.deviceId = ""

        // Reset analytics session
        AnalyticsManager.reset()

        _authState.value = AuthResult.NotAuthenticated
        _currentUser.value = null
    }

    /**
     * Refresh authentication token
     */
    fun refreshToken() {
        viewModelScope.launch {
            val refreshToken = sessionManager.getRefreshToken()
            if (refreshToken == null) {
                Log.w(TAG, "No refresh token available")
                signOut()
                return@launch
            }

            try {
                val response = RetrofitClient.api.refreshToken(
                    RefreshTokenRequest(refreshToken)
                )

                if (response.isSuccessful && response.body()?.success == true) {
                    val authResponse = response.body()!!
                    val token = authResponse.token!!
                    val user = authResponse.user!!

                    sessionManager.saveAuthToken(token)
                    sessionManager.saveUser(user)

                    // Update deviceId in ConfigManager after refresh
                    val configManager = ConfigManager.Companion.getInstance(getApplication())
                    authResponse.device?.id?.let { configManager.deviceId = it }
                    // Sync survey completion status from backend
                    configManager.isSurveyComplete = user.surveyCompleted

                    _currentUser.value = user
                    _authState.value = AuthResult.Success(token = token, user = user)
                    Log.d(TAG, "Token refreshed successfully, surveyCompleted: ${user.surveyCompleted}")
                } else {
                    Log.e(TAG, "Token refresh failed")
                    signOut()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Token refresh error", e)
                signOut()
            }
        }
    }

    /**
     * Get access token for API requests
     */
    fun getAccessToken(): String? {
        return sessionManager.getAccessToken()
    }

    /**
     * Check if user is authenticated
     */
    fun isAuthenticated(): Boolean {
        return sessionManager.isAuthenticated()
    }

    override fun onCleared() {
        super.onCleared()
        oAuthManager.dispose()
    }
}
