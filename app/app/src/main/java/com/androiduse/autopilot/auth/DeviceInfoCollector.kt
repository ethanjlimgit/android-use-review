package com.androiduse.autopilot.auth

import android.content.Context
import android.os.Build
import android.provider.Settings
import android.util.DisplayMetrics
import android.view.WindowManager
import com.androiduse.autopilot.auth.api.DeviceInfo

/**
 * Utility class for collecting device information
 */
object DeviceInfoCollector {
    /**
     * Collect device information for authentication requests
     */
    fun collectDeviceInfo(context: Context): DeviceInfo {
        // Get device ID (Android ID)
        val deviceId = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        ) ?: "unknown"

        // Get display metrics
        val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val displayMetrics = DisplayMetrics()

        // Use currentWindowMetrics for API 30+ (min SDK is 30)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val windowMetrics = windowManager.currentWindowMetrics
            val bounds = windowMetrics.bounds
            displayMetrics.widthPixels = bounds.width()
            displayMetrics.heightPixels = bounds.height()
            displayMetrics.densityDpi = context.resources.displayMetrics.densityDpi
            displayMetrics.density = context.resources.displayMetrics.density
        } else {
            @Suppress("DEPRECATION")
            windowManager.defaultDisplay.getMetrics(displayMetrics)
        }

        // Get screen refresh rate
        // Note: Using defaultDisplay even for API 30+ because context.display
        // only works with visual contexts (Activity), not application contexts
        val refreshRate = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                @Suppress("DEPRECATION")
                windowManager.defaultDisplay.mode.refreshRate.toInt()
            } else {
                @Suppress("DEPRECATION")
                windowManager.defaultDisplay.refreshRate.toInt()
            }
        } catch (e: Exception) {
            // Fallback to 60Hz if we can't get the refresh rate
            60
        }

        return DeviceInfo(
            deviceId = deviceId,
            name = "${Build.MANUFACTURER} ${Build.MODEL}",
            manufacturer = Build.MANUFACTURER,
            model = Build.MODEL,
            osVersion = Build.VERSION.RELEASE,
            apiLevel = Build.VERSION.SDK_INT,
            displayMetrics = com.androiduse.autopilot.auth.api.DisplayMetrics(
                widthPixels = displayMetrics.widthPixels,
                heightPixels = displayMetrics.heightPixels,
                densityDpi = displayMetrics.densityDpi,
                density = displayMetrics.density,
                refreshRate = refreshRate
            )
        )
    }
}
