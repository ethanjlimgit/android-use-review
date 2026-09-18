package com.androiduse.autopilot.auth.model

data class User(
    val id: String,
    val email: String,
    val name: String? = null,
    val picture: String? = null,
    val provider: AuthProvider,
    val surveyCompleted: Boolean = false
)

enum class AuthProvider {
    EMAIL,
    GOOGLE,
    GITHUB,
    TWITTER,
    UNKNOWN
}
