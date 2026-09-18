package com.androiduse.autopilot.core

import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.os.Build
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * Utility class for enumerating installed applications.
 * Consolidates duplicate app listing logic with support for caching and filtering.
 */
class AppLister(private val packageManager: PackageManager) {

    companion object {
        private const val TAG = "AppLister"
    }

    data class AppInfo(
        val packageName: String,
        val label: String,
        val versionName: String?,
        val versionCode: Long,
        val isSystemApp: Boolean
    )

    /**
     * Query all launchable apps from the system.
     *
     * @param includeVersionInfo Whether to include version name and code
     * @return List of AppInfo objects
     */
    fun queryLaunchableApps(includeVersionInfo: Boolean = true): List<AppInfo> {
        Log.d(TAG, "Querying launchable apps (includeVersionInfo=$includeVersionInfo)")

        val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }

        val resolvedApps: List<ResolveInfo> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            packageManager.queryIntentActivities(mainIntent, PackageManager.ResolveInfoFlags.of(0L))
        } else {
            @Suppress("DEPRECATION")
            packageManager.queryIntentActivities(mainIntent, 0)
        }

        Log.d(TAG, "Found ${resolvedApps.size} raw resolved apps")

        val appList = mutableListOf<AppInfo>()

        for (resolveInfo in resolvedApps) {
            try {
                val pkgInfo = try {
                    packageManager.getPackageInfo(resolveInfo.activityInfo.packageName, 0)
                } catch (e: PackageManager.NameNotFoundException) {
                    Log.w(TAG, "Package not found: ${resolveInfo.activityInfo.packageName}")
                    continue
                }

                val label = try {
                    resolveInfo.loadLabel(packageManager).toString()
                } catch (e: Exception) {
                    Log.w(TAG, "Label load failed for ${pkgInfo.packageName}: ${e.message}")
                    // Fallback to package name if label load fails
                    pkgInfo.packageName
                }

                val appInfo = resolveInfo.activityInfo.applicationInfo
                val isSystem = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0

                appList.add(
                    AppInfo(
                        packageName = pkgInfo.packageName,
                        label = label,
                        versionName = if (includeVersionInfo) pkgInfo.versionName else null,
                        versionCode = if (includeVersionInfo) pkgInfo.longVersionCode else 0L,
                        isSystemApp = isSystem
                    )
                )
            } catch (e: Exception) {
                Log.w(TAG, "Skipping package ${resolveInfo.activityInfo.packageName}: ${e.message}")
            }
        }

        Log.d(TAG, "Successfully enumerated ${appList.size} apps")
        return appList
    }

    /**
     * Convert list of AppInfo to JSONArray.
     *
     * @param apps List of AppInfo objects
     * @param includeVersionInfo Whether to include version details in JSON
     * @return JSONArray containing app information
     */
    fun toJSONArray(apps: List<AppInfo>, includeVersionInfo: Boolean = true): JSONArray {
        val arr = JSONArray()

        for (app in apps) {
            val obj = JSONObject()
            obj.put("packageName", app.packageName)
            obj.put("label", app.label)
            obj.put("isSystemApp", app.isSystemApp)

            if (includeVersionInfo) {
                obj.put("versionName", app.versionName ?: JSONObject.NULL)
                obj.put("versionCode", app.versionCode)
            }

            arr.put(obj)
        }

        return arr
    }

    /**
     * Filter apps by system status.
     *
     * @param apps List of AppInfo objects
     * @param includeSystem Whether to include system apps
     * @return Filtered list
     */
    fun filterBySystemStatus(apps: List<AppInfo>, includeSystem: Boolean): List<AppInfo> {
        return if (includeSystem) {
            apps
        } else {
            apps.filter { !it.isSystemApp }
        }
    }

    /**
     * Query and convert to JSONArray in one step.
     *
     * @param includeVersionInfo Whether to include version details
     * @param includeSystemApps Whether to include system apps
     * @return JSONArray of apps
     */
    fun queryAsJSONArray(
        includeVersionInfo: Boolean = true,
        includeSystemApps: Boolean = true
    ): JSONArray {
        val apps = queryLaunchableApps(includeVersionInfo)
        val filtered = filterBySystemStatus(apps, includeSystemApps)
        return toJSONArray(filtered, includeVersionInfo)
    }
}
