package com.androiduse.autopilot.survey.model

/**
 * Data class representing a user's survey response
 */
data class SurveyResponse(
    val userId: String,
    val email: String,
    val isCompany: Boolean,
    val companySize: String? = null,
    val industry: String? = null,
    val role: String? = null,
    val customRole: String? = null,
    val useCase: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)
