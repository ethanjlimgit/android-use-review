package com.androiduse.autopilot.survey.model

/**
 * Data Transfer Object for submitting survey to backend API
 * Fields must match the backend's completeSurveySchema validation
 */
data class SurveyRequest(
    val userType: String,          // "individual" or "company"
    val companySize: String? = null, // "just_me", "2-10", "11-50", "51-200", "201-1000", "1000+"
    val industry: String,           // Normalized industry value (e.g., "technology", "real_estate")
    val occupation: String,         // Free-form text (2-100 chars)
    val useCase: String            // Free-form text (10-500 chars, REQUIRED)
)

/**
 * API response from survey submission
 */
data class SurveyApiResponse(
    val success: Boolean,
    val message: String? = null,
    val error: String? = null
)
