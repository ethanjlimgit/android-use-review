package com.androiduse.autopilot.config

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.core.content.edit
import com.androiduse.autopilot.core.SingletonHolder
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Settings manager for AI auto-reply notification feature.
 * Controls which apps/contacts get auto-replies, rate limiting, and custom instructions.
 */
class NotificationReplySettings private constructor(private val context: Context) {

    companion object : SingletonHolder<NotificationReplySettings, Context>(
        { ctx -> NotificationReplySettings(ctx.applicationContext) }
    ) {
        private const val TAG = "NotifReplySettings"
        private const val PREFS_NAME = "notification_reply_settings"

        private const val KEY_GLOBAL_ENABLED = "global_enabled"
        private const val KEY_FILTER_MODE = "filter_mode"
        private const val KEY_ENABLED_APPS = "enabled_apps"
        private const val KEY_DISABLED_APPS = "disabled_apps"
        private const val KEY_PER_CONTACT_RULES = "per_contact_rules"
        private const val KEY_CUSTOM_INSTRUCTIONS = "custom_instructions"
        private const val KEY_COOLDOWN_SECONDS = "cooldown_seconds"
        private const val KEY_DAILY_LIMIT = "daily_limit"
        private const val KEY_DAILY_REPLY_COUNT = "daily_reply_count"
        private const val KEY_DAILY_REPLY_DATE = "daily_reply_date"

        private const val FILTER_MODE_ALLOWLIST = "allowlist"
        private const val FILTER_MODE_BLOCKLIST = "blocklist"
        private const val DEFAULT_COOLDOWN_SECONDS = 300
        private const val DEFAULT_DAILY_LIMIT = 50
    }

    private val sharedPrefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val gson = Gson()

    // In-memory tracking for cooldown (not persisted across restarts)
    val lastReplyTimestamps = ConcurrentHashMap<String, Long>()

    // Daily reply count (persisted)
    private val dailyReplyCount = AtomicInteger(loadDailyReplyCount())

    var globalEnabled: Boolean
        get() = sharedPrefs.getBoolean(KEY_GLOBAL_ENABLED, false)
        set(value) {
            sharedPrefs.edit { putBoolean(KEY_GLOBAL_ENABLED, value) }
        }

    var filterMode: String
        get() = sharedPrefs.getString(KEY_FILTER_MODE, FILTER_MODE_ALLOWLIST) ?: FILTER_MODE_ALLOWLIST
        set(value) {
            sharedPrefs.edit { putString(KEY_FILTER_MODE, value) }
        }

    var enabledApps: Set<String>
        get() = sharedPrefs.getStringSet(KEY_ENABLED_APPS, emptySet()) ?: emptySet()
        set(value) {
            sharedPrefs.edit { putStringSet(KEY_ENABLED_APPS, value) }
        }

    var disabledApps: Set<String>
        get() = sharedPrefs.getStringSet(KEY_DISABLED_APPS, emptySet()) ?: emptySet()
        set(value) {
            sharedPrefs.edit { putStringSet(KEY_DISABLED_APPS, value) }
        }

    var customInstructions: String
        get() = sharedPrefs.getString(KEY_CUSTOM_INSTRUCTIONS, "") ?: ""
        set(value) {
            sharedPrefs.edit { putString(KEY_CUSTOM_INSTRUCTIONS, value) }
        }

    var cooldownSeconds: Int
        get() = sharedPrefs.getInt(KEY_COOLDOWN_SECONDS, DEFAULT_COOLDOWN_SECONDS)
        set(value) {
            sharedPrefs.edit { putInt(KEY_COOLDOWN_SECONDS, value) }
        }

    var dailyLimit: Int
        get() = sharedPrefs.getInt(KEY_DAILY_LIMIT, DEFAULT_DAILY_LIMIT)
        set(value) {
            sharedPrefs.edit { putInt(KEY_DAILY_LIMIT, value) }
        }

    /**
     * Get per-contact rules as a map of "packageName:senderName" -> enabled
     */
    fun getPerContactRules(): Map<String, Boolean> {
        return try {
            val json = sharedPrefs.getString(KEY_PER_CONTACT_RULES, null) ?: return emptyMap()
            val type = object : TypeToken<Map<String, Boolean>>() {}.type
            gson.fromJson(json, type) ?: emptyMap()
        } catch (e: Exception) {
            Log.e(TAG, "Error reading per-contact rules: ${e.message}", e)
            emptyMap()
        }
    }

    /**
     * Set a per-contact rule
     * @param packageName App package name
     * @param senderName Contact/sender name
     * @param enabled Whether auto-reply is enabled for this contact
     */
    fun setPerContactRule(packageName: String, senderName: String, enabled: Boolean) {
        val rules = getPerContactRules().toMutableMap()
        rules["$packageName:$senderName"] = enabled
        sharedPrefs.edit { putString(KEY_PER_CONTACT_RULES, gson.toJson(rules)) }
    }

    /**
     * Remove a per-contact rule
     */
    fun removePerContactRule(packageName: String, senderName: String) {
        val rules = getPerContactRules().toMutableMap()
        rules.remove("$packageName:$senderName")
        sharedPrefs.edit { putString(KEY_PER_CONTACT_RULES, gson.toJson(rules)) }
    }

    /**
     * Determine whether auto-reply should be sent for a given notification.
     * Checks global toggle, filter mode, per-contact rules, cooldown, and daily limit.
     */
    fun shouldAutoReply(packageName: String, senderName: String?): Boolean {
        // 1. Global toggle
        if (!globalEnabled) return false

        // 2. Per-contact rule takes priority
        if (senderName != null) {
            val contactKey = "$packageName:$senderName"
            val contactRule = getPerContactRules()[contactKey]
            if (contactRule != null) return contactRule
        }

        // 3. Filter mode check
        val appAllowed = when (filterMode) {
            FILTER_MODE_ALLOWLIST -> packageName in enabledApps
            FILTER_MODE_BLOCKLIST -> packageName !in disabledApps
            else -> false
        }
        if (!appAllowed) return false

        // 4. Daily limit check
        resetDailyCountIfNeeded()
        if (dailyReplyCount.get() >= dailyLimit) {
            Log.d(TAG, "Daily limit reached: ${dailyReplyCount.get()}/$dailyLimit")
            return false
        }

        // 5. Cooldown check
        val cooldownKey = if (senderName != null) "$packageName:$senderName" else packageName
        val lastReply = lastReplyTimestamps[cooldownKey]
        if (lastReply != null) {
            val elapsed = (System.currentTimeMillis() - lastReply) / 1000
            if (elapsed < cooldownSeconds) {
                Log.d(TAG, "Cooldown active for $cooldownKey: ${elapsed}s / ${cooldownSeconds}s")
                return false
            }
        }

        return true
    }

    /**
     * Record that a reply was sent for rate limiting purposes.
     */
    fun recordReply(packageName: String, senderName: String?) {
        val cooldownKey = if (senderName != null) "$packageName:$senderName" else packageName
        lastReplyTimestamps[cooldownKey] = System.currentTimeMillis()

        resetDailyCountIfNeeded()
        val count = dailyReplyCount.incrementAndGet()
        sharedPrefs.edit { putInt(KEY_DAILY_REPLY_COUNT, count) }
    }

    /**
     * Get current daily reply count
     */
    fun getDailyReplyCount(): Int {
        resetDailyCountIfNeeded()
        return dailyReplyCount.get()
    }

    private fun loadDailyReplyCount(): Int {
        val savedDate = sharedPrefs.getString(KEY_DAILY_REPLY_DATE, null)
        val today = todayDateString()
        return if (savedDate == today) {
            sharedPrefs.getInt(KEY_DAILY_REPLY_COUNT, 0)
        } else {
            0
        }
    }

    private fun resetDailyCountIfNeeded() {
        val savedDate = sharedPrefs.getString(KEY_DAILY_REPLY_DATE, null)
        val today = todayDateString()
        if (savedDate != today) {
            dailyReplyCount.set(0)
            sharedPrefs.edit {
                putString(KEY_DAILY_REPLY_DATE, today)
                putInt(KEY_DAILY_REPLY_COUNT, 0)
            }
        }
    }

    private fun todayDateString(): String {
        val cal = java.util.Calendar.getInstance()
        return "${cal.get(java.util.Calendar.YEAR)}-${cal.get(java.util.Calendar.MONTH)}-${cal.get(java.util.Calendar.DAY_OF_MONTH)}"
    }
}
