package com.androiduse.autopilot.paywall

import android.app.Activity
import android.content.Context
import android.util.Log
import com.androiduse.autopilot.core.SingletonHolder
import com.google.android.play.core.review.ReviewInfo
import com.google.android.play.core.review.ReviewManagerFactory

/**
 * Manages in-app review prompts for Google Play Store.
 *
 * Features:
 * - Automatically prompts for review after 300 credits used
 * - Only prompts once per user
 * - Uses Google Play In-App Review API for seamless experience
 * - Thread-safe singleton pattern
 *
 * Usage:
 * Call checkAndRequestReview() after each task completion.
 * The manager will handle all logic internally.
 */
class ReviewManager private constructor(private val context: Context) {

    companion object : SingletonHolder<ReviewManager, Context>(
        { ctx -> ReviewManager(ctx.applicationContext) }
    ) {
        private const val TAG = "ReviewManager"
        private const val PREFS_NAME = "review_prefs"
        private const val KEY_HAS_REQUESTED_REVIEW = "has_requested_review"
        private const val KEY_LAST_CREDIT_CHECK = "last_credit_check"
        private const val REVIEW_THRESHOLD_CREDITS = 300
    }

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val playReviewManager = ReviewManagerFactory.create(context)
    private var reviewInfo: ReviewInfo? = null

    /**
     * Check if user should be prompted for review and request if appropriate.
     *
     * Conditions for showing review:
     * 1. User has used >= 300 credits
     * 2. User has not been prompted before
     * 3. Activity context is available
     *
     * @param activity The activity context to show the review flow
     * @return true if review was requested, false otherwise
     */
    fun checkAndRequestReview(activity: Activity?): Boolean {
        if (activity == null) {
            Log.d(TAG, "No activity context available for review")
            return false
        }

        // Check if already prompted
        if (hasRequestedReview()) {
            Log.d(TAG, "User already prompted for review")
            return false
        }

        // Check credit usage
        val taskLimitManager = TaskLimitManager.getInstance(context)
        val creditsUsed = taskLimitManager.creditsUsed

        Log.d(TAG, "Checking review eligibility: creditsUsed=$creditsUsed, threshold=$REVIEW_THRESHOLD_CREDITS")

        if (creditsUsed < REVIEW_THRESHOLD_CREDITS) {
            // Update last check to avoid redundant checks
            updateLastCreditCheck(creditsUsed)
            return false
        }

        // Eligible for review!
        Log.d(TAG, "User eligible for review - requesting review flow")
        requestReviewFlow(activity)
        return true
    }

    /**
     * Request the in-app review flow from Google Play.
     *
     * This preloads the review info and launches the flow.
     * The flow may or may not show depending on Google Play's quotas.
     */
    private fun requestReviewFlow(activity: Activity) {
        // Request review info
        val request = playReviewManager.requestReviewFlow()
        request.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                reviewInfo = task.result
                Log.d(TAG, "Review info loaded successfully")

                // Launch the review flow
                reviewInfo?.let { info ->
                    val flow = playReviewManager.launchReviewFlow(activity, info)
                    flow.addOnCompleteListener {
                        Log.d(TAG, "Review flow completed")
                        // Mark as prompted regardless of whether user actually reviewed
                        // This prevents repeated prompts
                        markReviewAsRequested()
                    }
                }
            } else {
                Log.e(TAG, "Failed to load review info: ${task.exception?.message}")
                // Mark as requested to avoid repeated failures
                markReviewAsRequested()
            }
        }
    }

    /**
     * Check if user has already been prompted for review.
     */
    private fun hasRequestedReview(): Boolean {
        return prefs.getBoolean(KEY_HAS_REQUESTED_REVIEW, false)
    }

    /**
     * Mark that the user has been prompted for review.
     */
    private fun markReviewAsRequested() {
        prefs.edit().putBoolean(KEY_HAS_REQUESTED_REVIEW, true).apply()
        Log.d(TAG, "Marked user as having been prompted for review")
    }

    /**
     * Update the last credit check value.
     *
     * This is used to avoid redundant checks when credits haven't changed.
     */
    private fun updateLastCreditCheck(credits: Int) {
        prefs.edit().putInt(KEY_LAST_CREDIT_CHECK, credits).apply()
    }

    /**
     * Get the last credit check value.
     */
    private fun getLastCreditCheck(): Int {
        return prefs.getInt(KEY_LAST_CREDIT_CHECK, 0)
    }

    /**
     * Check if credits have increased since last check.
     *
     * This can be used to optimize when to check for review eligibility.
     */
    fun shouldCheckForReview(): Boolean {
        if (hasRequestedReview()) {
            return false
        }

        val taskLimitManager = TaskLimitManager.getInstance(context)
        val currentCredits = taskLimitManager.creditsUsed
        val lastChecked = getLastCreditCheck()

        return currentCredits > lastChecked
    }

    /**
     * Reset review state (for testing or user logout).
     */
    fun resetReviewState() {
        prefs.edit().clear().apply()
        Log.d(TAG, "Review state reset")
    }

    /**
     * Get debug information.
     */
    fun getDebugInfo(): String {
        val taskLimitManager = TaskLimitManager.getInstance(context)
        return buildString {
            appendLine("ReviewManager Debug Info:")
            appendLine("  Credits Used: ${taskLimitManager.creditsUsed}")
            appendLine("  Review Threshold: $REVIEW_THRESHOLD_CREDITS")
            appendLine("  Has Requested Review: ${hasRequestedReview()}")
            appendLine("  Last Credit Check: ${getLastCreditCheck()}")
            appendLine("  Should Check: ${shouldCheckForReview()}")
        }
    }
}
