package com.androiduse.autopilot.auth.model

data class SignUpRequest(
    val email: String,
    val password: String,
    val name: String? = null
)

data class SignInRequest(
    val email: String,
    val password: String
)

data class EmailValidationResult(
    val isValid: Boolean,
    val error: String? = null
)

data class PasswordValidationResult(
    val isValid: Boolean,
    val error: String? = null,
    val strength: PasswordStrength = PasswordStrength.WEAK
)

enum class PasswordStrength {
    WEAK,
    MEDIUM,
    STRONG
}
