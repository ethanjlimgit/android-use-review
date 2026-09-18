package com.androiduse.autopilot.auth.model

sealed class AuthResult {
    data class Success(val token: AuthToken, val user: User) : AuthResult()
    data class SignUpPending(val message: String, val userId: String, val emailSent: Boolean) : AuthResult()
    data class Error(val message: String, val exception: Throwable? = null) : AuthResult()
    object Loading : AuthResult()
    object NotAuthenticated : AuthResult()
}
