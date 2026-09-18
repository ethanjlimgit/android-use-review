package com.androiduse.autopilot.cache

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.androiduse.autopilot.auth.api.UserProfileResponse

/**
 * Cache for user profile data
 *
 * Stores profile information in SharedPreferences for fast initial display
 * while fetching fresh data from the server.
 */
class ProfileCache private constructor(context: Context) {

    companion object {
        private const val TAG = "ProfileCache"
        private const val PREFS_NAME = "profile_cache"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_USER_IMAGE = "user_image"
        private const val KEY_SURVEY_COMPLETED = "survey_completed"
        private const val KEY_CACHE_TIMESTAMP = "cache_timestamp"

        @Volatile
        private var instance: ProfileCache? = null

        fun getInstance(context: Context): ProfileCache {
            return instance ?: synchronized(this) {
                instance ?: ProfileCache(context.applicationContext).also { instance = it }
            }
        }
    }

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * Cache a user profile response
     */
    fun cacheProfile(profile: UserProfileResponse) {
        prefs.edit().apply {
            putString(KEY_USER_ID, profile.id)
            putString(KEY_USER_NAME, profile.name)
            putString(KEY_USER_EMAIL, profile.email)
            putString(KEY_USER_IMAGE, profile.image)
            putBoolean(KEY_SURVEY_COMPLETED, profile.surveyCompleted ?: false)
            putLong(KEY_CACHE_TIMESTAMP, System.currentTimeMillis())
            apply()
        }
        Log.d(TAG, "Profile cached for: ${profile.email}")
    }

    /**
     * Get cached profile, or null if not cached
     */
    fun getCachedProfile(): UserProfileResponse? {
        val id = prefs.getString(KEY_USER_ID, null) ?: return null
        return UserProfileResponse(
            id = id,
            name = prefs.getString(KEY_USER_NAME, null),
            email = prefs.getString(KEY_USER_EMAIL, null),
            image = prefs.getString(KEY_USER_IMAGE, null),
            surveyCompleted = prefs.getBoolean(KEY_SURVEY_COMPLETED, false)
        )
    }

    /**
     * Clear all cached profile data
     */
    fun clearCache() {
        prefs.edit().clear().apply()
        Log.d(TAG, "Profile cache cleared")
    }
}
