package com.androiduse.autopilot.auth

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.exceptions.GetCredentialException
import com.androiduse.autopilot.BuildConfig
import com.androiduse.autopilot.auth.api.GoogleTokenRequest
import com.androiduse.autopilot.auth.api.RetrofitClient
import com.androiduse.autopilot.auth.model.AuthResult
import com.androiduse.autopilot.config.ConfigManager
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.security.MessageDigest
import java.util.UUID

class GoogleAuthManager(
    private val context: Context,
    private val sessionManager: SessionManager
) {
    companion object {
        private const val TAG = "GoogleAuthManager"
    }

    /**
     * Referral code to include with signup request
     */
    private var referralCode: String? = null

    /**
     * Set the referral code to be used for signup
     */
    fun setReferralCode(code: String?) {
        referralCode = code
    }

    /**
     * Google Cloud Project's Web Client ID (Web application type)
     * This is required for Credential Manager (modern flow) to work
     * Configured per build flavor (dev/staging/production)
     */
    private val WEB_CLIENT_ID = BuildConfig.GOOGLE_WEB_CLIENT_ID

    /**
     * Google Cloud Project's OAuth Client ID (Android type with SHA-1)
     * This is required for legacy Google Sign-In fallback
     * Must be registered with SHA-1 certificate fingerprint in Google Cloud Console
     * Configured per build flavor (dev/staging/production)
     */
    private val OAUTH_CLIENT_ID = BuildConfig.GOOGLE_OAUTH_CLIENT_ID

    private val credentialManager = CredentialManager.create(context)

    /**
     * Legacy Google Sign-In client (fallback for devices where Credential Manager fails)
     */
    private var legacyGoogleSignInClient: GoogleSignInClient? = null

    /**
     * Store the activity context when sign in is initiated
     */
    private var activityContext: Activity? = null

    /**
     * Callback for legacy sign-in flow
     */
    var onLegacySignInRequired: ((Intent) -> Unit)? = null

    /**
     * Set the activity context before calling signInWithGoogle
     * This is required for Credential Manager to display the account picker UI
     */
    fun setActivityContext(activity: Activity) {
        activityContext = activity
    }

    /**
     * Sign in with Google using Credential Manager
     * This provides the best native experience
     * IMPORTANT: Must call setActivityContext() before calling this method
     */
    suspend fun signInWithGoogle(): AuthResult = withContext(Dispatchers.IO) {
        try {
            // Ensure we have an Activity context
            val activity = activityContext
            if (activity == null) {
                Log.e(TAG, "Activity context not set. Call setActivityContext() before signInWithGoogle()")
                return@withContext AuthResult.Error(
                    message = "Internal error: Activity context not available"
                )
            }

            // Generate nonce for security
            val nonce = generateNonce()
            val hashedNonce = hashNonce(nonce)

            // Configure Google ID option with relaxed constraints
            val googleIdOption = GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false) // Allow all Google accounts
                .setServerClientId(WEB_CLIENT_ID)
                .setAutoSelectEnabled(true) // Auto-select if only one account
                .setNonce(hashedNonce)
                .build()

            // Build credential request
            val request = GetCredentialRequest.Builder()
                .addCredentialOption(googleIdOption)
                .build()

            // Get credentials using Activity context
            val result = try {
                credentialManager.getCredential(
                    request = request,
                    context = activity
                )
            } catch (e: GetCredentialException) {
                Log.e(TAG, "Modern Credential Manager failed: ${e.javaClass.simpleName}", e)

                // Check if error is user cancellation - don't trigger fallback
                val isCancellation = e.message?.contains("canceled", ignoreCase = true) == true ||
                                   e.message?.contains("user_canceled", ignoreCase = true) == true ||
                                   e.javaClass.simpleName.contains("Canceled", ignoreCase = true)

                if (isCancellation) {
                    Log.d(TAG, "User cancelled sign-in, not triggering legacy fallback")
                    return@withContext AuthResult.Error(
                        message = "Sign in was cancelled",
                        exception = e
                    )
                }

                // HYBRID STRATEGY: Fallback to legacy Google Sign-In
                // This handles devices with Play Services bugs, missing OEM configs, etc.
                Log.w(TAG, "Triggering legacy Google Sign-In fallback...")
                return@withContext triggerLegacySignIn(activity)
            }

            // Handle the credential
            handleSignIn(result)
        } catch (e: Exception) {
            Log.e(TAG, "Google sign in failed", e)
            AuthResult.Error(
                message = "Google sign in failed: ${e.message}",
                exception = e
            )
        }
    }

    /**
     * Handle the sign-in credential response
     */
    private suspend fun handleSignIn(result: GetCredentialResponse): AuthResult {
        val credential = result.credential

        return when {
            credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL -> {
                try {
                    // Extract Google ID token
                    val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
                    val idToken = googleIdTokenCredential.idToken

                    Log.d(TAG, "Google ID Token received: ${idToken.take(20)}...")

                    // Exchange token with backend
                    exchangeGoogleTokenWithBackend(idToken)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to parse Google credential", e)
                    AuthResult.Error(
                        message = "Failed to parse Google credential: ${e.message}",
                        exception = e
                    )
                }
            }
            else -> {
                Log.e(TAG, "Unexpected credential type: ${credential.type}")
                AuthResult.Error(message = "Unexpected credential type")
            }
        }
    }

    /**
     * Exchange Google ID token with backend for session JWT
     */
    private suspend fun exchangeGoogleTokenWithBackend(idToken: String): AuthResult {
        return try {
            // Collect device information
            val deviceInfo = DeviceInfoCollector.collectDeviceInfo(context)

            val request = GoogleTokenRequest(
                idToken = idToken,
                serverClientId = WEB_CLIENT_ID,
                deviceInfo = deviceInfo,
                referralCode = referralCode
            )

            val response = RetrofitClient.api.exchangeGoogleToken(request)

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

                // Clear referral code after successful authentication
                referralCode = null

                AuthResult.Success(token = token, user = user)
            } else {
                // Parse error message from error body (response.body() is null for error responses)
                val errorMessage = RetrofitClient.parseErrorMessage(response, "Authentication failed")
                Log.e(TAG, "Backend authentication failed: $errorMessage")
                AuthResult.Error(message = errorMessage)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Token exchange failed", e)
            AuthResult.Error(
                message = "Failed to authenticate with backend: ${e.message}",
                exception = e
            )
        }
    }

    /**
     * Trigger legacy Google Sign-In flow (fallback for Credential Manager failures)
     * Returns a special error that tells the UI to launch the legacy intent
     */
    private fun triggerLegacySignIn(activity: Activity): AuthResult {
        try {
            // Initialize legacy Google Sign-In client if needed
            if (legacyGoogleSignInClient == null) {
                Log.d(TAG, "Initializing legacy Google Sign-In client")
                Log.d(TAG, "OAuth Client ID (for legacy): ${OAUTH_CLIENT_ID.take(20)}...")
                Log.d(TAG, "Web Client ID (for Credential Manager): ${WEB_CLIENT_ID.take(20)}...")
                Log.d(TAG, "Package name: ${activity.packageName}")

                // NOTE: requestIdToken() must use Web Client ID (not Android OAuth Client ID)
                // The Android OAuth Client ID with SHA-1 is only for linking the app to the project
                val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                    .requestEmail()
                    .requestIdToken(WEB_CLIENT_ID)
                    .build()

                legacyGoogleSignInClient = GoogleSignIn.getClient(activity, gso)
            }

            val signInIntent = legacyGoogleSignInClient!!.signInIntent

            // Invoke callback to launch the intent
            onLegacySignInRequired?.invoke(signInIntent)

            // Return a pending state
            return AuthResult.Error(
                message = "LEGACY_SIGNIN_PENDING",
                exception = null
            )
        } catch (e: Exception) {
            Log.e(TAG, "Legacy sign-in initialization failed", e)
            return AuthResult.Error(
                message = "Google Sign-In is not available on this device. Please try another sign-in method.",
                exception = e
            )
        }
    }

    /**
     * Handle legacy Google Sign-In result from ActivityResultLauncher
     * Call this from your Activity's result handler
     */
    suspend fun handleLegacySignInResult(data: Intent?): AuthResult = withContext(Dispatchers.IO) {
        try {
            if (data == null) {
                Log.e(TAG, "Legacy sign-in: No data received")
                return@withContext AuthResult.Error(message = "Sign in was cancelled")
            }

            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            val account = task.getResult(ApiException::class.java)

            if (account?.idToken == null) {
                Log.e(TAG, "Legacy sign-in: No ID token received")
                return@withContext AuthResult.Error(
                    message = "Failed to get Google ID token. Please try again."
                )
            }

            Log.d(TAG, "Legacy Google ID Token received: ${account.idToken!!.take(20)}...")

            // Exchange token with backend (same flow as modern path)
            exchangeGoogleTokenWithBackend(account.idToken!!)
        } catch (e: ApiException) {
            Log.e(TAG, "Legacy sign-in failed with API exception", e)
            Log.e(TAG, "Error code: ${e.statusCode}")

            val errorMessage = when (e.statusCode) {
                10 -> {
                    Log.e(TAG, "DEVELOPER_ERROR (10): SHA-1 certificate fingerprint not configured in Google Cloud Console")
                    "Google Sign-In configuration error. Please contact support."
                }
                12501 -> "Sign in was cancelled"
                12500 -> "Google Play Services error. Please update Google Play Services."
                7 -> "Network error. Please check your internet connection."
                8 -> "Internal error. Please try again."
                else -> "Google Sign-In failed: ${e.message}"
            }
            AuthResult.Error(message = errorMessage, exception = e)
        } catch (e: Exception) {
            Log.e(TAG, "Legacy sign-in failed", e)
            AuthResult.Error(
                message = "Google sign in failed: ${e.message}",
                exception = e
            )
        }
    }

    /**
     * Sign out from Google
     */
    fun signOut() {
        sessionManager.clearSession()

        // Reset task limit for new user
        val configManager = ConfigManager.Companion.getInstance(context)
        configManager.resetTaskLimitForNewUser()

        // Sign out from legacy client if initialized
        legacyGoogleSignInClient?.signOut()

        // Note: Credential Manager doesn't require explicit sign out
        // The session is cleared from local storage
    }

    /**
     * Generate a random nonce for security
     */
    private fun generateNonce(): String {
        return UUID.randomUUID().toString()
    }

    /**
     * Hash the nonce using SHA-256
     */
    private fun hashNonce(nonce: String): String {
        val bytes = nonce.toByteArray(Charsets.UTF_8)
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(bytes)
        return hash.joinToString("") { "%02x".format(it) }
    }
}
