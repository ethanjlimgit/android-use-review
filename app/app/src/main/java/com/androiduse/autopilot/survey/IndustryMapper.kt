package com.androiduse.autopilot.survey

import android.util.Log

/**
 * Maps Android UI industry strings to backend database enum values
 *
 * Android displays user-friendly strings (e.g., "Real Estate", "Non-Profit")
 * Backend expects lowercase snake_case keys (e.g., "real_estate", "nonprofit")
 */
object IndustryMapper {

    /**
     * Complete mapping of all 17 industry options
     */
    private val industryMap = mapOf(
        "Technology" to "technology",
        "Healthcare" to "healthcare",
        "Finance" to "finance",
        "Education" to "education",
        "Retail" to "retail",
        "Manufacturing" to "manufacturing",
        "Real Estate" to "real_estate",
        "Transportation" to "automotive",  // Backend uses "automotive" for transportation
        "Marketing" to "marketing",
        "Legal" to "consulting",          // Backend groups legal under consulting
        "Non-Profit" to "nonprofit",
        "Government" to "government",
        "Entertainment" to "entertainment",
        "Hospitality" to "other",         // Backend doesn't have hospitality, map to other
        "Construction" to "other",        // Backend doesn't have construction, map to other
        "Agriculture" to "agriculture",
        "Other" to "other"
    )

    /**
     * Normalizes Android UI string to backend enum value
     *
     * @param uiString The industry string from Android UI (e.g., "Real Estate")
     * @return Normalized backend enum value (e.g., "real_estate")
     */
    fun normalizeIndustry(uiString: String?): String {
        if (uiString.isNullOrBlank()) {
            return "other"
        }

        // Direct lookup with fallback to "other"
        return industryMap[uiString] ?: run {
            Log.w("IndustryMapper", "Unknown industry: $uiString, defaulting to 'other'")
            "other"
        }
    }

    /**
     * Validates if a UI string can be mapped
     */
    fun isValidIndustry(uiString: String?): Boolean {
        return uiString != null && industryMap.containsKey(uiString)
    }
}
