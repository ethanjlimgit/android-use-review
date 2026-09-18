package com.androiduse.autopilot.auth.model

data class AuthToken(
    val accessToken: String,
    val refreshToken: String? = null,
    val expiresIn: Long? = null,
    val tokenType: String = "Bearer"
)
