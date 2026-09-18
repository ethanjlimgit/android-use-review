package com.androiduse.autopilot.api

import android.content.pm.PackageManager
import android.util.Log
import com.androiduse.autopilot.core.AppLister
import com.androiduse.autopilot.core.JsonBuilders
import com.androiduse.autopilot.core.StateRepository
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

/**
 * Handles all read-only API operations (queries)
 * Responsible for retrieving state, trees, device information, and apps
 */
class QueryApiHandler(
    private val stateRepo: StateRepository,
    private val getPackageManager: () -> PackageManager,
    private val appVersionProvider: () -> String,
) {
    companion object {
        private const val TAG = "QueryApiHandler"
        private const val SCREENSHOT_TIMEOUT_SECONDS = 5L
        private const val APPS_CACHE_TTL_MS = 24 * 60 * 60 * 1000L // 1 day (24 hours)
    }

    // Lazy-initialized app lister utility
    private val appLister: AppLister by lazy {
        AppLister(getPackageManager())
    }

    // Apps cache: stores full list of all apps (both system and non-system)
    @Volatile
    private var cachedApps: JSONObject? = null

    @Volatile
    private var appsCacheTimestamp: Long = 0

    /**
     * Simple ping to test connectivity
     */
    fun ping() = ApiResponse.Success("pong")

    /**
     * Get the accessibility tree (visible elements only)
     */
    fun getTree(): ApiResponse {
        val elements = stateRepo.getVisibleElements()
        val json = elements.map { JsonBuilders.elementNodeToJson(it) }
        return ApiResponse.Success(JSONArray(json).toString())
    }

    /**
     * Get the full accessibility tree with optional filtering
     */
    fun getTreeFull(filter: Boolean): ApiResponse {
        val tree = stateRepo.getFullTree(filter)
            ?: return ApiResponse.Error("No active window or root filtered out")
        return ApiResponse.Success(tree.toString())
    }

    /**
     * Get the current phone state (focused element, keyboard visibility, etc.)
     */
    fun getPhoneState(): ApiResponse {
        val state = stateRepo.getPhoneState()
        return ApiResponse.Success(JsonBuilders.phoneStateToJson(state).toString())
    }

    /**
     * Get combined state (tree + phone state)
     */
    fun getState(): ApiResponse {
        val elements = stateRepo.getVisibleElements()
        val treeJson = elements.map { JsonBuilders.elementNodeToJson(it) }
        val phoneStateJson = JsonBuilders.phoneStateToJson(stateRepo.getPhoneState())

        val combined = JSONObject().apply {
            put("a11y_tree", JSONArray(treeJson))
            put("phone_state", phoneStateJson)
        }
        return ApiResponse.Success(combined.toString())
    }

    /**
     * Get full combined state (full tree + phone state + device context)
     */
    fun getStateFull(filter: Boolean): ApiResponse {
        return try {
            Log.d(TAG, "getStateFull called with filter=$filter")

            val tree = stateRepo.getFullTree(filter)
            if (tree == null) {
                Log.w(TAG, "getStateFull: No active window or root filtered out")
                return ApiResponse.Error("No active window or root filtered out")
            }

            val phoneStateJson = JsonBuilders.phoneStateToJson(stateRepo.getPhoneState())
            val deviceContext = stateRepo.getDeviceContext()

            val combined = JSONObject().apply {
                put("a11y_tree", tree)
                put("phone_state", phoneStateJson)
                put("device_context", deviceContext)
            }

            Log.d(TAG, "getStateFull: Successfully built response")
            ApiResponse.RawObject(combined)
        } catch (e: Exception) {
            Log.e(TAG, "getStateFull: Error building state", e)
            ApiResponse.Error("Error building state: ${e.message}")
        }
    }

    /**
     * Get the app version
     */
    fun getVersion() = ApiResponse.Success(appVersionProvider())

    /**
     * Get list of all packages with version info
     */
    fun getPackages(): ApiResponse {
        Log.d(TAG, "getPackages called")
        return try {
            val arr = appLister.queryAsJSONArray(
                includeVersionInfo = true,
                includeSystemApps = true
            )
            Log.d(TAG, "Returning ${arr.length()} packages")
            ApiResponse.RawArray(arr)
        } catch (e: Exception) {
            Log.e(TAG, "getPackages failed", e)
            ApiResponse.Error("Failed to enumerate launchable apps: ${e.message}")
        }
    }

    /**
     * Get current time in milliseconds
     */
    fun getTime(): ApiResponse {
        return ApiResponse.Success(System.currentTimeMillis())
    }

    /**
     * Get current date as formatted string
     */
    fun getDate(): ApiResponse {
        val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
        val dateString = dateFormat.format(Date())
        return ApiResponse.Success(dateString)
    }

    /**
     * Get list of apps with caching
     * @param includeSystem Whether to include system apps in the result
     */
    fun getApps(includeSystem: Boolean = true): ApiResponse {
        Log.d(TAG, "getApps called (includeSystem=$includeSystem)")

        // Check cache validity
        val now = System.currentTimeMillis()
        val cacheValid = cachedApps != null &&
                        (now - appsCacheTimestamp) < APPS_CACHE_TTL_MS

        if (cacheValid) {
            Log.d(TAG, "Returning cached apps list")
            val cached = cachedApps!!
            val allApps = cached.getJSONArray("apps")

            if (includeSystem) {
                // Return all apps from cache
                return ApiResponse.RawObject(cached)
            } else {
                // Filter out system apps
                val filteredApps = JSONArray()
                for (i in 0 until allApps.length()) {
                    val app = allApps.getJSONObject(i)
                    if (!app.optBoolean("isSystemApp", false)) {
                        filteredApps.put(app)
                    }
                }
                val result = JSONObject()
                result.put("apps", filteredApps)
                return ApiResponse.RawObject(result)
            }
        }

        // Cache miss or expired - fetch fresh data
        Log.d(TAG, "Cache miss or expired, fetching fresh apps list")
        return try {
            // Use AppLister to fetch all apps (no version info needed for this endpoint)
            val arr = appLister.queryAsJSONArray(
                includeVersionInfo = false,
                includeSystemApps = true
            )

            Log.d(TAG, "Fetched ${arr.length()} apps, updating cache")

            // Cache the full list (all apps, both system and non-system)
            val result = JSONObject()
            result.put("apps", arr)

            // Update cache
            cachedApps = result
            appsCacheTimestamp = now

            // Filter based on includeSystem parameter
            if (includeSystem) {
                ApiResponse.RawObject(result)
            } else {
                // Filter out system apps
                val filteredApps = JSONArray()
                for (i in 0 until arr.length()) {
                    val app = arr.getJSONObject(i)
                    if (!app.optBoolean("isSystemApp", false)) {
                        filteredApps.put(app)
                    }
                }
                val filteredResult = JSONObject()
                filteredResult.put("apps", filteredApps)
                ApiResponse.RawObject(filteredResult)
            }

        } catch (e: Exception) {
            Log.e(TAG, "getApps failed", e)
            ApiResponse.Error("Failed to enumerate apps: ${e.message}")
        }
    }

    /**
     * Invalidate the apps cache.
     * Call this when apps are installed/uninstalled to ensure fresh data.
     */
    fun invalidateAppsCache() {
        Log.d(TAG, "Invalidating apps cache")
        cachedApps = null
        appsCacheTimestamp = 0
    }

    /**
     * Preload apps cache in background
     * This ensures the cache is ready when backend requests it
     */
    fun preloadAppsCache() {
        Log.d(TAG, "Preloading apps cache...")
        try {
            // Trigger getApps which will cache the result
            getApps(includeSystem = true)
            Log.d(TAG, "Apps cache preloaded successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Error preloading apps cache: ${e.message}", e)
        }
    }

    /**
     * Take a screenshot and return as base64-encoded string
     * @param hideOverlay Whether to temporarily hide the overlay during capture
     */
    fun getScreenshot(hideOverlay: Boolean): ApiResponse {
        return try {
            val future = stateRepo.takeScreenshot(hideOverlay)
            // Wait up to a fixed timeout
            val result = future.get(SCREENSHOT_TIMEOUT_SECONDS, TimeUnit.SECONDS)

            if (result.startsWith("error:")) {
                ApiResponse.Error(result.substring(7))
            } else {
                // Result is Base64 string from Service.
                // decode it back to bytes to pass as Binary response.
                // In future, Service should return bytes directly to avoid this encode/decode cycle.
                // val bytes = android.util.Base64.decode(result, android.util.Base64.DEFAULT)

                // use base64 encoding to be compatible with json rpc 1.0.
                ApiResponse.Text(result)
            }
        } catch (e: TimeoutException) {
            ApiResponse.Error("Screenshot timeout - operation took too long")
        } catch (e: Exception) {
            ApiResponse.Error("Failed to get screenshot: ${e.message}")
        }
    }
}
