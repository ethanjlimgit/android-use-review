package com.androiduse.autopilot.paywall

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.androiduse.autopilot.analytics.AnalyticsManager
import com.androiduse.autopilot.auth.api.RetrofitClient
import com.androiduse.autopilot.auth.api.SubscriptionInfo
import com.androiduse.autopilot.core.SingletonHolder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.atomic.AtomicReference

/**
 * Manages subscription status and validation
 *
 * Features:
 * - Fetches subscription info from backend API
 * - Caches subscription status with TTL (5 minutes)
 * - Thread-safe singleton pattern
 * - Fail-open: If sync fails, uses cached data
 * - Provides subscription status checks for paywall logic
 *
 * Usage:
 * val manager = SubscriptionManager.getInstance(context)
 * if (manager.hasActiveSubscription()) {
 *     // Allow unlimited tasks
 * } else {
 *     // Enforce free tier limits
 * }
 */
class SubscriptionManager private constructor(context: Context) {

    companion object : SingletonHolder<SubscriptionManager, Context>(
        { ctx -> SubscriptionManager(ctx.applicationContext) }
    ) {
        private const val TAG = "SubscriptionManager"
        private const val PREFS_NAME = "subscription_cache"
        private const val KEY_TIER = "tier"
        private const val KEY_STATUS = "status"
        private const val KEY_CREDIT_ALLOWANCE = "credit_allowance"
        private const val KEY_CREDITS_USED = "credits_used"
        private const val KEY_FREE_BONUS_CREDITS = "free_bonus_credits"
        private const val KEY_TOTAL_AVAILABLE_CREDITS = "total_available_credits"
        private const val KEY_LAST_SYNC = "last_sync"
        private const val KEY_CANCEL_AT_PERIOD_END = "cancel_at_period_end"

        // Cache TTL: 5 minutes
        private const val CACHE_TTL_MS = 5 * 60 * 1000L

        // Cooldown between sync attempts: 1 minute
        private const val SYNC_COOLDOWN_MS = 60 * 1000L
    }

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // In-memory cache for fast reads
    private val cachedSubscription = AtomicReference<SubscriptionInfo?>(null)

    // Track last sync attempt to prevent excessive API calls
    private var lastSyncAttempt: Long = 0

    init {
        // Load cached subscription on initialization
        loadFromPrefs()
    }

    /**
     * Check if user has an active subscription
     *
     * Returns true if:
     * - status is "active" or "trialing"
     * - tier is not "free"
     *
     * Returns false if:
     * - status is "inactive", "canceled", or "past_due"
     * - tier is "free"
     * - no subscription info available (defaults to free)
     */
    fun hasActiveSubscription(): Boolean {
        val subscription = cachedSubscription.get()

        if (subscription == null) {
            Log.d(TAG, "No subscription info cached - treating as free tier")
            return false
        }

        val isActive = (subscription.status == "active" || subscription.status == "trialing")
                    && subscription.tier != "free"

        Log.d(TAG, "Subscription check: tier=${subscription.tier}, status=${subscription.status}, isActive=$isActive")
        return isActive
    }

    /**
     * Get current subscription tier
     * Returns "free", "basic", "premium", or "business"
     */
    fun getTier(): String {
        return cachedSubscription.get()?.tier ?: "free"
    }

    /**
     * Get current subscription status
     * Returns "inactive", "active", "canceled", "past_due", or "trialing"
     */
    fun getStatus(): String {
        return cachedSubscription.get()?.status ?: "inactive"
    }

    /**
     * Get cached subscription info
     */
    fun getSubscriptionInfo(): SubscriptionInfo? {
        return cachedSubscription.get()
    }

    /**
     * Check if user is on free trial
     */
    fun isOnTrial(): Boolean {
        return cachedSubscription.get()?.status == "trialing"
    }

    /**
     * Check if subscription is scheduled for cancellation
     */
    fun isCancelScheduled(): Boolean {
        return cachedSubscription.get()?.cancelAtPeriodEnd == true
    }

    /**
     * Sync subscription status from server
     *
     * - Respects cooldown period to prevent excessive API calls (unless force=true)
     * - Updates cache on success
     * - Fail-open: Keeps cached data on failure
     * - Runs on IO dispatcher
     *
     * @param force If true, bypasses the cooldown period. Use after task completion
     *              when credits have been consumed and UI needs immediate update.
     */
    suspend fun syncFromServer(force: Boolean = false): Boolean = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()

        // Enforce cooldown (unless forced)
        if (!force && now - lastSyncAttempt < SYNC_COOLDOWN_MS) {
            Log.d(TAG, "Sync skipped - cooldown active")
            return@withContext false
        }

        lastSyncAttempt = now

        try {
            Log.d(TAG, "Syncing subscription from server...")
            val response = RetrofitClient.api.getSubscription()

            if (response.isSuccessful && response.body() != null) {
                val subscription = response.body()!!
                val previousTier = cachedSubscription.get()?.tier
                val previousStatus = cachedSubscription.get()?.status

                updateCache(subscription)
                Log.i(TAG, "Subscription synced: tier=${subscription.tier}, status=${subscription.status}")

                // Track subscription changes
                if (previousTier != null && previousTier != subscription.tier) {
                    AnalyticsManager.capture(
                        event = "subscription_tier_changed",
                        properties = mapOf(
                            "previous_tier" to previousTier,
                            "new_tier" to subscription.tier
                        )
                    )
                }

                if (previousStatus != null && previousStatus != subscription.status) {
                    AnalyticsManager.capture(
                        event = "subscription_status_changed",
                        properties = mapOf(
                            "previous_status" to previousStatus,
                            "new_status" to subscription.status,
                            "tier" to subscription.tier
                        )
                    )
                }

                // Track subscription synced event
                AnalyticsManager.capture(
                    event = "subscription_synced",
                    properties = mapOf(
                        "tier" to subscription.tier,
                        "status" to subscription.status,
                        "cancel_at_period_end" to (subscription.cancelAtPeriodEnd ?: false)
                    )
                )

                return@withContext true
            } else {
                Log.w(TAG, "Failed to sync subscription: ${response.code()} ${response.message()}")
                return@withContext false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error syncing subscription from server", e)
            return@withContext false
        }
    }

    /**
     * Sync subscription asynchronously without blocking
     * Use this for fire-and-forget syncs
     */
    fun syncInBackground() {
        CoroutineScope(Dispatchers.IO).launch {
            syncFromServer()
        }
    }

    /**
     * Force clear cache (useful after payment completion)
     */
    fun clearCache() {
        cachedSubscription.set(null)
        prefs.edit().clear().apply()
        Log.d(TAG, "Subscription cache cleared")
    }

    /**
     * Update subscription cache with new data
     */
    private fun updateCache(subscription: SubscriptionInfo) {
        // Update in-memory cache
        cachedSubscription.set(subscription)

        // Persist to SharedPreferences
        prefs.edit().apply {
            putString(KEY_TIER, subscription.tier)
            putString(KEY_STATUS, subscription.status)
            putInt(KEY_CREDIT_ALLOWANCE, subscription.creditAllowance)
            putInt(KEY_CREDITS_USED, subscription.creditsUsed)
            putInt(KEY_FREE_BONUS_CREDITS, subscription.freeBonusCredits)
            putInt(KEY_TOTAL_AVAILABLE_CREDITS, subscription.totalAvailableCredits)
            putLong(KEY_LAST_SYNC, System.currentTimeMillis())
            putBoolean(KEY_CANCEL_AT_PERIOD_END, subscription.cancelAtPeriodEnd ?: false)
            apply()
        }
    }

    /**
     * Load cached subscription from SharedPreferences
     */
    private fun loadFromPrefs() {
        val lastSync = prefs.getLong(KEY_LAST_SYNC, 0)
        val now = System.currentTimeMillis()

        // Check if cache is expired
        if (now - lastSync > CACHE_TTL_MS) {
            Log.d(TAG, "Cached subscription expired - will sync from server")
            return
        }

        val tier = prefs.getString(KEY_TIER, null)
        val status = prefs.getString(KEY_STATUS, null)

        if (tier != null && status != null) {
            val subscription = SubscriptionInfo(
                tier = tier,
                status = status,
                creditAllowance = prefs.getInt(KEY_CREDIT_ALLOWANCE, 0),
                creditsUsed = prefs.getInt(KEY_CREDITS_USED, 0),
                freeBonusCredits = prefs.getInt(KEY_FREE_BONUS_CREDITS, 0),
                totalAvailableCredits = prefs.getInt(KEY_TOTAL_AVAILABLE_CREDITS, 0),
                creditResetDate = null,
                currentPeriodEnd = null,
                cancelAtPeriodEnd = prefs.getBoolean(KEY_CANCEL_AT_PERIOD_END, false),
                hasStripeCustomer = true
            )

            cachedSubscription.set(subscription)
            Log.d(TAG, "Loaded cached subscription: tier=$tier, status=$status")
        }
    }

    /**
     * Check if cache is stale and needs refresh
     */
    fun isCacheStale(): Boolean {
        val lastSync = prefs.getLong(KEY_LAST_SYNC, 0)
        val now = System.currentTimeMillis()
        return now - lastSync > CACHE_TTL_MS
    }
}
