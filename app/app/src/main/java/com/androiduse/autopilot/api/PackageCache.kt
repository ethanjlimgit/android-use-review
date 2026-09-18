package com.androiduse.autopilot.api

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import org.json.JSONArray
import java.util.concurrent.TimeUnit

/**
 * Cache for installed packages with 1-day expiration
 */
class PackageCache private constructor(private val context: Context) {

    companion object {
        private const val TAG = "PackageCache"
        private const val PREFS_NAME = "package_cache"
        private const val KEY_PACKAGES = "packages_json"
        private const val KEY_TIMESTAMP = "cache_timestamp"
        private val CACHE_VALIDITY_MS = TimeUnit.DAYS.toMillis(1) // 1 day

        @Volatile
        private var instance: PackageCache? = null

        fun getInstance(context: Context): PackageCache {
            return instance ?: synchronized(this) {
                instance ?: PackageCache(context.applicationContext).also { instance = it }
            }
        }
    }

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private var cachedPackages: JSONArray? = null
    private var lastFetchTime: Long = 0L

    /**
     * Get packages from cache or fetch if needed
     * @param apiHandler The ApiHandler to use for fetching if cache is invalid
     * @param forceRefresh Force refresh even if cache is valid
     * @return JSONArray of package information
     */
    fun getPackages(apiHandler: ApiHandler, forceRefresh: Boolean = false): JSONArray? {
        val now = System.currentTimeMillis()

        // Check memory cache first
        if (!forceRefresh && cachedPackages != null && (now - lastFetchTime) < CACHE_VALIDITY_MS) {
            Log.d(TAG, "Returning packages from memory cache (age: ${(now - lastFetchTime) / 1000}s)")
            return cachedPackages
        }

        // Check persistent cache
        if (!forceRefresh) {
            val savedTimestamp = prefs.getLong(KEY_TIMESTAMP, 0L)
            if ((now - savedTimestamp) < CACHE_VALIDITY_MS) {
                val packagesJson = prefs.getString(KEY_PACKAGES, null)
                if (packagesJson != null) {
                    try {
                        cachedPackages = JSONArray(packagesJson)
                        lastFetchTime = savedTimestamp
                        Log.d(TAG, "Loaded ${cachedPackages!!.length()} packages from persistent cache (age: ${(now - savedTimestamp) / 1000}s)")
                        return cachedPackages
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to parse cached packages: ${e.message}", e)
                        // Fall through to fetch fresh data
                    }
                }
            } else {
                Log.d(TAG, "Cache expired (age: ${(now - savedTimestamp) / 1000}s, max: ${CACHE_VALIDITY_MS / 1000}s)")
            }
        }

        // Fetch fresh data
        return fetchAndCachePackages(apiHandler)
    }

    /**
     * Fetch packages from ApiHandler and update cache
     */
    private fun fetchAndCachePackages(apiHandler: ApiHandler): JSONArray? {
        Log.d(TAG, "Fetching packages from system...")
        return try {
            val response = apiHandler.getPackages()
            when (response) {
                is ApiResponse.RawArray -> {
                    val packages = response.json
                    Log.d(TAG, "Fetched ${packages.length()} packages, caching...")

                    // Update memory cache
                    cachedPackages = packages
                    lastFetchTime = System.currentTimeMillis()

                    // Update persistent cache
                    prefs.edit()
                        .putString(KEY_PACKAGES, packages.toString())
                        .putLong(KEY_TIMESTAMP, lastFetchTime)
                        .apply()

                    Log.d(TAG, "Successfully cached ${packages.length()} packages")
                    packages
                }
                is ApiResponse.Error -> {
                    Log.e(TAG, "Failed to fetch packages: ${response.message}")
                    null
                }
                else -> {
                    Log.e(TAG, "Unexpected response type: ${response.javaClass.simpleName}")
                    null
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching and caching packages: ${e.message}", e)
            null
        }
    }

    /**
     * Force refresh the cache
     */
    fun refresh(apiHandler: ApiHandler): JSONArray? {
        Log.d(TAG, "Force refreshing package cache")
        return getPackages(apiHandler, forceRefresh = true)
    }

    /**
     * Clear the cache
     */
    fun clear() {
        Log.d(TAG, "Clearing package cache")
        cachedPackages = null
        lastFetchTime = 0L
        prefs.edit().clear().apply()
    }

    /**
     * Check if cache is valid
     */
    fun isCacheValid(): Boolean {
        val savedTimestamp = prefs.getLong(KEY_TIMESTAMP, 0L)
        val now = System.currentTimeMillis()
        val isValid = (now - savedTimestamp) < CACHE_VALIDITY_MS
        Log.d(TAG, "Cache validity check: $isValid (age: ${(now - savedTimestamp) / 1000}s)")
        return isValid
    }

    /**
     * Get cache age in seconds
     */
    fun getCacheAge(): Long {
        val savedTimestamp = prefs.getLong(KEY_TIMESTAMP, 0L)
        if (savedTimestamp == 0L) return -1
        return (System.currentTimeMillis() - savedTimestamp) / 1000
    }
}
