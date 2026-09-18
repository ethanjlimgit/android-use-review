package com.androiduse.autopilot.cache

import android.content.Context
import android.util.Log
import com.androiduse.autopilot.api.PackageCache
import com.androiduse.autopilot.paywall.ReviewManager
import com.androiduse.autopilot.paywall.SubscriptionManager
import com.androiduse.autopilot.paywall.TaskLimitManager
import com.androiduse.autopilot.survey.SurveyRepository

/**
 * Centralized cache coordinator
 *
 * Holds references to all user-specific caches and provides a single
 * clearAll() method to wipe them during sign-out.
 *
 * Not managed here (separate concerns):
 * - SessionManager: encrypted auth tokens, security-sensitive
 * - ConfigManager: app settings, not user cache
 */
class CacheManager private constructor(context: Context) {

    companion object {
        private const val TAG = "CacheManager"

        @Volatile
        private var instance: CacheManager? = null

        fun getInstance(context: Context): CacheManager {
            return instance ?: synchronized(this) {
                instance ?: CacheManager(context.applicationContext).also { instance = it }
            }
        }
    }

    val profileCache: ProfileCache = ProfileCache.getInstance(context)
    val taskCache: TaskCache = TaskCache.getInstance(context)

    private val packageCache: PackageCache = PackageCache.getInstance(context)
    private val subscriptionManager: SubscriptionManager = SubscriptionManager.getInstance(context)
    private val taskLimitManager: TaskLimitManager = TaskLimitManager.getInstance(context)
    private val reviewManager: ReviewManager = ReviewManager.getInstance(context)
    private val surveyRepository: SurveyRepository = SurveyRepository(context)

    /**
     * Clear all user-specific caches
     *
     * Call during sign-out to ensure no stale user data remains.
     */
    fun clearAll() {
        profileCache.clearCache()
        taskCache.clearCache()
        packageCache.clear()
        subscriptionManager.clearCache()
        taskLimitManager.resetForNewUser()
        reviewManager.resetReviewState()
        surveyRepository.clearSurveyResponse()
        Log.i(TAG, "All user caches cleared")
    }
}
