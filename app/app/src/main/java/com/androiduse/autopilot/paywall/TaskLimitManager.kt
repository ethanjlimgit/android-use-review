package com.androiduse.autopilot.paywall

import android.content.Context
import android.text.format.DateFormat
import android.util.Log
import com.androiduse.autopilot.core.SingletonHolder

/**
 * Manages credit usage limits and enforces the freemium credit paywall.
 *
 * Features:
 * - Retrieves credit usage from backend subscription API
 * - Thread-safe singleton pattern
 * - Subscription-aware: Bypasses limits for active subscribers
 * - Credit usage is synced from server via SubscriptionManager
 *
 * Credit System:
 * - Free tier: 600 credits/month (10 minutes of agent work)
 * - 1 credit = 1 second of agent work
 * - Credits are tracked server-side and retrieved via /api/subscription
 */
class TaskLimitManager private constructor(private val context: Context) {

    companion object : SingletonHolder<TaskLimitManager, Context>(
        { ctx -> TaskLimitManager(ctx.applicationContext) }
    ) {
        private const val TAG = "TaskLimitManager"
    }

    // Subscription manager for checking credit usage and subscription status
    private val subscriptionManager: SubscriptionManager by lazy {
        SubscriptionManager.getInstance(context)
    }

    /**
     * Current credit usage (read from subscription info)
     */
    val creditsUsed: Int
        get() = subscriptionManager.getSubscriptionInfo()?.creditsUsed ?: 0

    /**
     * Credit allowance for current tier (read from subscription info)
     */
    val creditAllowance: Int
        get() = subscriptionManager.getSubscriptionInfo()?.creditAllowance ?: 600 // Default 600 for free tier

    /**
     * Bonus credits from referrals and promotions (used first before regular credits)
     */
    val freeBonusCredits: Int
        get() = subscriptionManager.getSubscriptionInfo()?.freeBonusCredits ?: 0

    /**
     * Total available credits (bonus + remaining allowance)
     * Uses server value if valid, otherwise calculates client-side
     */
    val totalAvailableCredits: Int
        get() {
            val subscription = subscriptionManager.getSubscriptionInfo()
            val serverAvailable = subscription?.totalAvailableCredits ?: 0
            return if (serverAvailable > 0) {
                serverAvailable
            } else {
                // Fallback: calculate client-side
                val total = creditAllowance + freeBonusCredits
                maxOf(0, total - creditsUsed)
            }
        }

    /**
     * Check if user has reached their credit limit
     *
     * Thread-safe, fast operation suitable for main thread.
     *
     * Logic:
     * 1. If user has active subscription -> no limit (returns false)
     * 2. If user is on free tier -> enforce credit limit using totalAvailableCredits
     *
     * @return true if totalAvailableCredits <= 0 AND user has no active subscription
     */
    fun hasReachedLimit(): Boolean {
        // First check: Do they have an active subscription?
        if (subscriptionManager.hasActiveSubscription()) {
            Log.d(TAG, "User has active subscription - no credit limit")
            return false
        }

        // Free tier: enforce limit using totalAvailableCredits
        val subscription = subscriptionManager.getSubscriptionInfo()
        if (subscription == null) {
            Log.w(TAG, "No subscription info available - allowing task (fail-open)")
            return false
        }

        // Check if no credits available (includes bonus credits)
        val reachedLimit = subscription.totalAvailableCredits <= 0
        if (reachedLimit) {
            Log.d(TAG, "Free tier user has reached credit limit: available=${subscription.totalAvailableCredits}")
        }
        return reachedLimit
    }

    /**
     * Get remaining credits (for display purposes)
     * Uses totalAvailableCredits which includes bonus credits
     * @return number of credits remaining, minimum 0
     */
    fun getRemainingCredits(): Int {
        val subscription = subscriptionManager.getSubscriptionInfo() ?: return 600
        return maxOf(0, subscription.totalAvailableCredits)
    }

    /**
     * Get credit usage percentage (for display purposes)
     * Calculates based on total credits (allowance + bonus)
     * @return percentage of credits used (0-100)
     */
    fun getCreditUsagePercentage(): Int {
        val subscription = subscriptionManager.getSubscriptionInfo() ?: return 0
        val totalCredits = subscription.creditAllowance + subscription.freeBonusCredits
        if (totalCredits <= 0) return 0
        val used = totalCredits - subscription.totalAvailableCredits
        return ((used.toFloat() / totalCredits.toFloat()) * 100).toInt().coerceIn(0, 100)
    }

    /**
     * Sync credit usage from server
     *
     * Delegates to SubscriptionManager to fetch latest subscription info.
     * Credit usage is automatically updated when subscription is synced.
     *
     * @param force If true, bypasses the cooldown period for immediate sync.
     *              Use after task completion when credits have been consumed.
     * @return true if sync succeeded, false otherwise
     */
    suspend fun syncFromServer(force: Boolean = false): Boolean {
        Log.d(TAG, "Syncing credit usage from server... (force=$force)")
        return subscriptionManager.syncFromServer(force)
    }

    /**
     * Reset for new user session
     *
     * Call when user logs out or session is cleared.
     * Clears subscription cache.
     */
    fun resetForNewUser() {
        subscriptionManager.clearCache()
        Log.d(TAG, "Credit limit data reset for new user")
    }

    /**
     * Get debug information (for troubleshooting)
     */
    fun getDebugInfo(): String {
        val subscription = subscriptionManager.getSubscriptionInfo()

        return buildString {
            appendLine("TaskLimitManager (Credit-based) Debug Info:")
            if (subscription != null) {
                appendLine("  Credits Used: ${subscription.creditsUsed}")
                appendLine("  Credit Allowance: ${subscription.creditAllowance}")
                appendLine("  Bonus Credits: ${subscription.freeBonusCredits}")
                appendLine("  Total Available: ${subscription.totalAvailableCredits}")
                appendLine("  Remaining: ${getRemainingCredits()}")
                appendLine("  Usage Percentage: ${getCreditUsagePercentage()}%")
                appendLine("  Has Reached Limit: ${hasReachedLimit()}")

                if (subscription.creditResetDate != null) {
                    appendLine("  Credit Reset Date: ${subscription.creditResetDate}")
                }

                appendLine()
                appendLine("Subscription Info:")
                appendLine("  Tier: ${subscription.tier}")
                appendLine("  Status: ${subscription.status}")
                appendLine("  Has Active Subscription: ${subscriptionManager.hasActiveSubscription()}")
            } else {
                appendLine("  No subscription info available")
                appendLine("  Default allowance: 600 credits (free tier)")
            }
        }
    }
}

/**
 * Result of a server sync operation
 */
sealed class SyncResult {
    /**
     * Sync succeeded
     * @param creditsUsed The credit usage retrieved from server
     */
    data class Success(val creditsUsed: Int) : SyncResult()

    /**
     * Sync failed
     * @param error Error message
     */
    data class Failure(val error: String) : SyncResult()
}
