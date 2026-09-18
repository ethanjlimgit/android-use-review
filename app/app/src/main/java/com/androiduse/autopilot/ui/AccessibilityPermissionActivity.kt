package com.androiduse.autopilot.ui

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.androiduse.autopilot.R

/**
 * Transparent activity that shows a dialog requesting accessibility permission.
 * Used by FloatingButtonService since services cannot show dialogs directly.
 */
class AccessibilityPermissionActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Show dialog immediately
        showAccessibilityDialog()
    }

    private fun showAccessibilityDialog() {
        AlertDialog.Builder(this)
            .setTitle(R.string.accessibility_required_title)
            .setMessage(R.string.accessibility_required_message)
            .setPositiveButton(R.string.go_to_settings) { _, _ ->
                openAccessibilitySettings()
                finish()
            }
            .setNegativeButton(R.string.cancel) { _, _ ->
                finish()
            }
            .setOnCancelListener {
                finish()
            }
            .show()
    }

    private fun openAccessibilitySettings() {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            startActivity(intent)
        } catch (e: Exception) {
            // Fallback to general settings if accessibility settings not available
            val intent = Intent(Settings.ACTION_SETTINGS)
            startActivity(intent)
        }
    }
}
