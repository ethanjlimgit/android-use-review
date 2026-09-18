package com.androiduse.autopilot.survey

import android.util.Log

/**
 * Maps Android UI company size strings to backend enum values
 */
object CompanySizeMapper {

    private val sizeMap = mapOf(
        "Just me" to "just_me",
        "2-10 employees" to "2-10",
        "11-50 employees" to "11-50",
        "51-200 employees" to "51-200",
        "201-1000 employees" to "201-1000",
        "1000+ employees" to "1000+"
    )

    /**
     * Normalizes company size UI string to backend enum value
     *
     * @param uiString The company size string from Android UI
     * @return Normalized backend enum value or null if blank
     */
    fun normalizeCompanySize(uiString: String?): String? {
        if (uiString.isNullOrBlank()) {
            return null
        }

        return sizeMap[uiString] ?: run {
            Log.w("CompanySizeMapper", "Unknown company size: $uiString")
            null
        }
    }
}
