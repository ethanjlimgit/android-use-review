package com.androiduse.autopilot.auth

import android.content.Context
import android.util.Log
import android.util.Patterns
import com.androiduse.autopilot.auth.api.EmailPasswordSignInRequest
import com.androiduse.autopilot.auth.api.EmailPasswordSignUpRequest
import com.androiduse.autopilot.auth.api.ForgotPasswordRequest
import com.androiduse.autopilot.auth.api.ResendVerificationRequest
import com.androiduse.autopilot.auth.api.RetrofitClient
import com.androiduse.autopilot.auth.model.AuthResult
import com.androiduse.autopilot.auth.model.EmailValidationResult
import com.androiduse.autopilot.auth.model.PasswordStrength
import com.androiduse.autopilot.auth.model.PasswordValidationResult
import com.androiduse.autopilot.config.ConfigManager
import com.androiduse.autopilot.service.FCMTokenManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class EmailPasswordAuthManager(
    private val context: Context,
    private val sessionManager: SessionManager
) {
    companion object {
        private const val TAG = "EmailPasswordAuthManager"
        private const val MIN_PASSWORD_LENGTH = 8
    }

    /**
     * Sign up with email and password
     */
    suspend fun signUp(
        email: String,
        password: String,
        name: String? = null,
        referralCode: String? = null
    ): AuthResult = withContext(Dispatchers.IO) {
        try {
            // Validate email
            val emailValidation = validateEmail(email)
            if (!emailValidation.isValid) {
                return@withContext AuthResult.Error(emailValidation.error ?: "Invalid email")
            }

            // Validate password
            val passwordValidation = validatePassword(password)
            if (!passwordValidation.isValid) {
                return@withContext AuthResult.Error(passwordValidation.error ?: "Invalid password")
            }

            Log.d(TAG, "Attempting sign up for email: $email")

            // Make API request
            val request = EmailPasswordSignUpRequest(
                email = email.trim().lowercase(),
                password = password,
                name = name?.trim(),
                referralCode = referralCode
            )

            val response = RetrofitClient.api.signUp(request)

            if (response.isSuccessful) {
                val authResponse = response.body()

                // Check if this is a successful signup that requires email verification
                if (authResponse?.message != null && authResponse.userId != null) {
                    Log.d(TAG, "Sign up pending email verification: ${authResponse.message}")
                    return@withContext AuthResult.SignUpPending(
                        message = authResponse.message,
                        userId = authResponse.userId,
                        emailSent = authResponse.emailSent ?: false
                    )
                }

                // Check if this is an immediate sign-in response (with token and user)
                if (authResponse?.success == true && authResponse.token != null && authResponse.user != null) {
                    val token = authResponse.token
                    val user = authResponse.user

                    // Save to session
                    sessionManager.saveAuthToken(token)
                    sessionManager.saveUser(user)

                    // Set deviceId in ConfigManager after authentication
                    val configManager = ConfigManager.Companion.getInstance(context)
                    authResponse.device?.id?.let { configManager.deviceId = it }
                    // Sync survey completion status from backend
                    configManager.isSurveyComplete = user.surveyCompleted

                    Log.d(TAG, "Sign up successful for user: ${user.email}, surveyCompleted: ${user.surveyCompleted}")

                    // Register FCM token with backend after successful sign-up
                    FCMTokenManager.registerTokenIfAuthenticated(context)

                    return@withContext AuthResult.Success(token = token, user = user)
                }

                // If we got here, the response format was unexpected
                val errorMessage = authResponse?.error ?: "Unexpected sign up response"
                Log.e(TAG, "Sign up failed: $errorMessage")

                // Check if account already exists
                val friendlyMessage = if (errorMessage.contains("already exists", ignoreCase = true) ||
                                        errorMessage.contains("already registered", ignoreCase = true) ||
                                        errorMessage.contains("already in use", ignoreCase = true) ||
                                        errorMessage.contains("email is taken", ignoreCase = true)) {
                    "An account with this email already exists. Please sign in instead."
                } else {
                    errorMessage
                }

                AuthResult.Error(message = friendlyMessage)
            } else {
                // Parse error message from error body (response.body() is null for error responses)
                val errorMessage = RetrofitClient.parseErrorMessage(response, "Sign up failed")
                Log.e(TAG, "Sign up failed: $errorMessage (HTTP ${response.code()})")

                // Check if account already exists based on error message or HTTP status
                val friendlyMessage = when {
                    // Check error message content
                    errorMessage.contains("already exists", ignoreCase = true) ||
                    errorMessage.contains("already registered", ignoreCase = true) ||
                    errorMessage.contains("already in use", ignoreCase = true) ||
                    errorMessage.contains("email is taken", ignoreCase = true) ||
                    errorMessage.contains("duplicate", ignoreCase = true) -> {
                        "An account with this email already exists. Please sign in instead."
                    }
                    // 409 Conflict typically means resource already exists
                    response.code() == 409 -> {
                        "An account with this email already exists. Please sign in instead."
                    }
                    else -> errorMessage
                }

                AuthResult.Error(message = friendlyMessage)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Sign up error", e)
            AuthResult.Error(
                message = "Sign up failed: ${e.message}",
                exception = e
            )
        }
    }

    /**
     * Sign in with email and password
     */
    suspend fun signIn(
        email: String,
        password: String
    ): AuthResult = withContext(Dispatchers.IO) {
        try {
            // Basic validation
            if (email.isBlank() || password.isBlank()) {
                return@withContext AuthResult.Error("Email and password are required")
            }

            Log.d(TAG, "Attempting sign in for email: $email")

            // Collect device information
            val deviceInfo = DeviceInfoCollector.collectDeviceInfo(context)

            // Make API request
            val request = EmailPasswordSignInRequest(
                email = email.trim().lowercase(),
                password = password,
                deviceInfo = deviceInfo
            )

            val response = RetrofitClient.api.signIn(request)

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

                Log.d(TAG, "Sign in successful for user: ${user.email}, surveyCompleted: ${user.surveyCompleted}")

                // Register FCM token with backend after successful sign-in
                FCMTokenManager.registerTokenIfAuthenticated(context)

                AuthResult.Success(token = token, user = user)
            } else {
                // Parse error message from error body (response.body() is null for error responses)
                val errorMessage = RetrofitClient.parseErrorMessage(response, "Invalid email or password")
                Log.e(TAG, "Sign in failed: $errorMessage")
                AuthResult.Error(message = errorMessage)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Sign in error", e)
            AuthResult.Error(
                message = "Sign in failed: ${e.message}",
                exception = e
            )
        }
    }

    /**
     * Validate email format
     */
    fun validateEmail(email: String): EmailValidationResult {
        val trimmedEmail = email.trim()

        return when {
            trimmedEmail.isBlank() -> {
                EmailValidationResult(isValid = false, error = "Email is required")
            }
            !Patterns.EMAIL_ADDRESS.matcher(trimmedEmail).matches() -> {
                EmailValidationResult(isValid = false, error = "Invalid email format")
            }
            else -> {
                EmailValidationResult(isValid = true)
            }
        }
    }

    /**
     * Validate password strength
     */
    fun validatePassword(password: String): PasswordValidationResult {
        return when {
            password.isBlank() -> {
                PasswordValidationResult(
                    isValid = false,
                    error = "Password is required",
                    strength = PasswordStrength.WEAK
                )
            }
            password.length < MIN_PASSWORD_LENGTH -> {
                PasswordValidationResult(
                    isValid = false,
                    error = "Password must be at least $MIN_PASSWORD_LENGTH characters",
                    strength = PasswordStrength.WEAK
                )
            }
            else -> {
                val strength = calculatePasswordStrength(password)
                PasswordValidationResult(
                    isValid = true,
                    strength = strength
                )
            }
        }
    }

    /**
     * Calculate password strength
     */
    private fun calculatePasswordStrength(password: String): PasswordStrength {
        var score = 0

        // Length bonus
        if (password.length >= 12) score += 2
        else if (password.length >= MIN_PASSWORD_LENGTH) score += 1

        // Contains lowercase
        if (password.any { it.isLowerCase() }) score += 1

        // Contains uppercase
        if (password.any { it.isUpperCase() }) score += 1

        // Contains digits
        if (password.any { it.isDigit() }) score += 1

        // Contains special characters
        if (password.any { !it.isLetterOrDigit() }) score += 1

        return when {
            score >= 5 -> PasswordStrength.STRONG
            score >= 3 -> PasswordStrength.MEDIUM
            else -> PasswordStrength.WEAK
        }
    }

    /**
     * Resend email verification link
     */
    suspend fun resendVerificationEmail(email: String): AuthResult = withContext(Dispatchers.IO) {
        try {
            // Validate email
            val emailValidation = validateEmail(email)
            if (!emailValidation.isValid) {
                return@withContext AuthResult.Error(emailValidation.error ?: "Invalid email")
            }

            Log.d(TAG, "Requesting verification email resend for: $email")

            val request = ResendVerificationRequest(
                email = email.trim().lowercase()
            )

            val response = RetrofitClient.api.resendVerificationEmail(request)

            if (response.isSuccessful) {
                val messageResponse = response.body()
                val message = messageResponse?.message ?: "Verification email sent. Please check your inbox."
                Log.d(TAG, "Verification email resend response: $message")
                AuthResult.SignUpPending(
                    message = message,
                    userId = "",  // Not needed for resend
                    emailSent = true
                )
            } else {
                // Parse error message from error body (response.body() is null for error responses)
                val errorMessage = RetrofitClient.parseErrorMessage(response, "Failed to send verification email")
                Log.e(TAG, "Verification email resend failed: $errorMessage")
                AuthResult.Error(message = errorMessage)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Verification email resend error", e)
            AuthResult.Error(
                message = "Failed to send verification email: ${e.message}",
                exception = e
            )
        }
    }

    /**
     * Request password reset link
     */
    suspend fun forgotPassword(email: String): AuthResult = withContext(Dispatchers.IO) {
        try {
            // Validate email
            val emailValidation = validateEmail(email)
            if (!emailValidation.isValid) {
                return@withContext AuthResult.Error(emailValidation.error ?: "Invalid email")
            }

            Log.d(TAG, "Requesting password reset for: $email")

            val request = ForgotPasswordRequest(
                email = email.trim().lowercase()
            )

            val response = RetrofitClient.api.forgotPassword(request)

            if (response.isSuccessful) {
                val messageResponse = response.body()
                val message = messageResponse?.message
                    ?: "If an account exists with this email, you will receive a password reset link."
                Log.d(TAG, "Password reset response: $message")
                // Using SignUpPending as a generic "pending action" result
                AuthResult.SignUpPending(
                    message = message,
                    userId = "",
                    emailSent = true
                )
            } else {
                // Parse error message from error body (response.body() is null for error responses)
                val errorMessage = RetrofitClient.parseErrorMessage(response, "Failed to request password reset")
                Log.e(TAG, "Password reset failed: $errorMessage")
                AuthResult.Error(message = errorMessage)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Password reset error", e)
            AuthResult.Error(
                message = "Failed to request password reset: ${e.message}",
                exception = e
            )
        }
    }

    /**
     * Sign out
     */
    fun signOut() {
        sessionManager.clearSession()

        // Reset task limit for new user
        val configManager = ConfigManager.Companion.getInstance(context)
        configManager.resetTaskLimitForNewUser()
    }
}
