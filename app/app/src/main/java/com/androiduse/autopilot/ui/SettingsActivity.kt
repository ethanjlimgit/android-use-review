package com.androiduse.autopilot.ui

import android.Manifest
import android.app.ActivityManager
import android.content.ComponentName
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.provider.Settings
import android.util.Log
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.androiduse.autopilot.assistant.AssistantManager
import com.androiduse.autopilot.config.ConfigManager
import com.androiduse.autopilot.input.AndroidUseKeyboardIME
import com.androiduse.autopilot.service.AndroidUseAccessibilityService
import com.androiduse.autopilot.service.BackendWebSocketService
import com.androiduse.autopilot.service.FloatingButtonService
import com.androiduse.autopilot.BuildConfig
import com.androiduse.autopilot.R
import com.androiduse.autopilot.databinding.ActivitySettingsBinding

/**
 * Settings Activity
 *
 * Features:
 * - Floating button enable/disable switch
 * - Notification permission button
 * - Accessibility service permission button
 * - Backend agent connection status indicator
 */
class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private lateinit var configManager: ConfigManager

    // Backend WebSocket Service
    private var backendWsServiceConnection: ServiceConnection? = null
    private var boundBackendService: BackendWebSocketService? = null

    // Config change listener for real-time status updates
    private val configChangeListener = object : ConfigManager.ConfigChangeListener {
        override fun onOverlayVisibilityChanged(visible: Boolean) {}
        override fun onOverlayOffsetChanged(offset: Int) {}
        override fun onBackendWsConnectionStatusChanged(status: String) {
            runOnUiThread {
                binding.tvBackendStatus.text = status
                val color = when {
                    status.equals("Connected", ignoreCase = true) -> R.color.androiduse_success
                    status.equals("Connecting", ignoreCase = true) -> R.color.androiduse_orange
                    status.startsWith("Reconnecting", ignoreCase = true) -> R.color.androiduse_orange
                    else -> R.color.androiduse_error
                }
                binding.tvBackendStatus.setTextColor(getColor(color))
            }
        }
    }

    // Activity result launcher for overlay permission
    private val overlayPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { _ ->
        if (checkFloatingButtonPermission()) {
            // Overlay permission granted, check audio permission
            if (checkAudioPermission()) {
                // Both permissions granted, start service
                syncFloatingButtonState()
                if (binding.toggleFloatingButton.isChecked) {
                    startFloatingButtonService()
                }
            } else {
                // Request audio permission
                requestAudioPermission()
            }
        } else {
            // Permission denied, uncheck the toggle
            binding.toggleFloatingButton.isChecked = false
            Toast.makeText(
                this,
                "Overlay permission is required for floating button",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    companion object {
        private const val TAG = "SettingsActivity"
        private const val REQUEST_CODE_AUDIO_PERMISSION = 1002
        private const val REQUEST_CODE_MICROPHONE_PERMISSION = 1003
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        configManager = ConfigManager.Companion.getInstance(this)

        setupToolbar()
        setupFloatingButtonToggle()
        setupEventSoundToggle()
        setupRealtimeVoiceToggle()
        setupSpeechLanguageSpinner()
        setupKeyboardButtons()
        setupPermissionButtons()
        setupBackendStatusIndicator()
        setupVersionInfo()

        // Update initial status
        updateStatusIndicators()
    }

    override fun onResume() {
        super.onResume()

        // Register for real-time status updates
        configManager.addListener(configChangeListener)

        // Update status when returning to activity
        syncFloatingButtonState()
        updateStatusIndicators()
        updateBackendWsStatus()
        bindBackendWebSocketService()
    }

    override fun onPause() {
        super.onPause()

        // Unregister listener
        configManager.removeListener(configChangeListener)

        // Unbind from backend service
        backendWsServiceConnection?.let {
            try {
                unbindService(it)
            } catch (e: Exception) {
                Log.e(TAG, "Error unbinding service: ${e.message}")
            }
        }
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }

    private fun setupFloatingButtonToggle() {
        // Sync initial state
        syncFloatingButtonState()

        binding.toggleFloatingButton.setOnCheckedChangeListener { _, isChecked ->
            toggleFloatingButton(isChecked)
        }
    }

    private fun setupEventSoundToggle() {
        // Sync initial state
        binding.toggleEventSound.isChecked = configManager.eventSoundEnabled

        binding.toggleEventSound.setOnCheckedChangeListener { _, isChecked ->
            configManager.eventSoundEnabled = isChecked
            Log.d(TAG, "Event sound ${if (isChecked) "enabled" else "disabled"}")
        }
    }

    private fun setupRealtimeVoiceToggle() {
        // Sync initial state
        binding.toggleRealtimeVoice.isChecked = configManager.realtimeVoiceCommandEnabled

        binding.toggleRealtimeVoice.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                // Check microphone permission when enabling
                if (ContextCompat.checkSelfPermission(
                        this,
                        Manifest.permission.RECORD_AUDIO
                    ) != PackageManager.PERMISSION_GRANTED
                ) {
                    // Request microphone permission
                    ActivityCompat.requestPermissions(
                        this,
                        arrayOf(Manifest.permission.RECORD_AUDIO),
                        REQUEST_CODE_MICROPHONE_PERMISSION
                    )
                    // Temporarily uncheck until permission is granted
                    binding.toggleRealtimeVoice.isChecked = false
                    return@setOnCheckedChangeListener
                }
            }

            configManager.realtimeVoiceCommandEnabled = isChecked
            Log.d(TAG, "Real-time voice command ${if (isChecked) "enabled" else "disabled"}")

            if (isChecked) {
                Toast.makeText(
                    this,
                    "Real-time voice enabled. Speak during tasks to guide the agent.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun setupSpeechLanguageSpinner() {
        val languageLabels = resources.getStringArray(R.array.speech_language_labels)
        val languageValues = resources.getStringArray(R.array.speech_language_values)

        // Create adapter with custom styling for dark theme
        val adapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_item,
            languageLabels
        ).apply {
            setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }

        binding.spinnerSpeechLanguage.adapter = adapter

        // Set current selection based on saved config
        val currentLanguage = configManager.speechLanguage
        val currentIndex = languageValues.indexOf(currentLanguage).takeIf { it >= 0 } ?: 0
        binding.spinnerSpeechLanguage.setSelection(currentIndex)

        // Handle selection changes
        binding.spinnerSpeechLanguage.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                val selectedLanguage = languageValues[position]
                if (configManager.speechLanguage != selectedLanguage) {
                    configManager.speechLanguage = selectedLanguage
                    val languageName = languageLabels[position]
                    Log.d(TAG, "Speech language changed to: $selectedLanguage ($languageName)")
                    Toast.makeText(
                        this@SettingsActivity,
                        "Voice recognition language: $languageName",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }

            override fun onNothingSelected(parent: AdapterView<*>?) {
                // Do nothing
            }
        }
    }

    private fun setupKeyboardButtons() {
        // Enable keyboard button
        binding.btnEnableKeyboard.setOnClickListener {
            openKeyboardSettings()
        }

        // Select keyboard button
        binding.btnSelectKeyboard.setOnClickListener {
            showKeyboardPicker()
        }
    }

    private fun setupPermissionButtons() {
        // Default Assistant Button
        binding.btnSetAssistant.setOnClickListener {
            AssistantManager.openAssistantSettings(this)
        }

        // Accessibility Service Button
        binding.btnEnableAccessibility.setOnClickListener {
            openAccessibilitySettings()
        }

        // Notification Permission Button
        binding.btnEnableNotification.setOnClickListener {
            openNotificationSettings()
        }
    }

    private fun setupBackendStatusIndicator() {
        // Status will be updated in onResume
    }

    private fun setupVersionInfo() {
        binding.tvVersionInfo.text = "Version ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})"
    }

    // ===== Status Updates =====

    private fun updateStatusIndicators() {
        updateKeyboardStatusIndicator()
        updateAssistantStatusIndicator()
        updateAccessibilityStatusIndicator()
        updateNotificationStatusIndicator()
    }

    private fun updateAssistantStatusIndicator() {
        val isDefault = AssistantManager.isDefaultAssistant(this)

        if (isDefault) {
            binding.tvAssistantStatus.text = "Active"
            binding.tvAssistantStatus.setTextColor(getColor(R.color.androiduse_success))
        } else {
            binding.tvAssistantStatus.text = "Not Set"
            binding.tvAssistantStatus.setTextColor(getColor(R.color.androiduse_error))
        }
    }

    private fun updateAccessibilityStatusIndicator() {
        val isEnabled = isAccessibilityServiceEnabled()

        if (isEnabled) {
            binding.tvAccessibilityStatus.text = "Enabled"
            binding.tvAccessibilityStatus.setTextColor(getColor(R.color.androiduse_success))
        } else {
            binding.tvAccessibilityStatus.text = "Disabled"
            binding.tvAccessibilityStatus.setTextColor(getColor(R.color.androiduse_error))
        }
    }

    private fun updateNotificationStatusIndicator() {
        val isEnabled = isNotificationListenerEnabled()

        if (isEnabled) {
            binding.tvNotificationStatus.text = "Enabled"
            binding.tvNotificationStatus.setTextColor(getColor(R.color.androiduse_success))
        } else {
            binding.tvNotificationStatus.text = "Disabled"
            binding.tvNotificationStatus.setTextColor(getColor(R.color.androiduse_error))
        }
    }

    private fun updateBackendWsStatus() {
        // Try bound service first, then static instance
        val service = boundBackendService ?: BackendWebSocketService.Companion.getInstance()
        if (service != null) {
            val status = service.getConnectionStatus()
            binding.tvBackendStatus.text = status

            val color = when {
                status.equals("Connected", ignoreCase = true) -> R.color.androiduse_success
                status.equals("Connecting", ignoreCase = true) -> R.color.androiduse_orange
                status.startsWith("Reconnecting", ignoreCase = true) -> R.color.androiduse_orange
                else -> R.color.androiduse_error
            }
            binding.tvBackendStatus.setTextColor(getColor(color))
        } else {
            binding.tvBackendStatus.text = "Disconnected"
            binding.tvBackendStatus.setTextColor(getColor(R.color.androiduse_error))
        }
    }

    private fun updateKeyboardStatusIndicator() {
        val isEnabled = isKeyboardEnabled()
        val isSelected = isKeyboardSelected()

        when {
            isSelected -> {
                binding.tvKeyboardStatus.text = "Active"
                binding.tvKeyboardStatus.setTextColor(getColor(R.color.androiduse_success))
                binding.btnEnableKeyboard.text = "Open Keyboard Settings"
                binding.btnSelectKeyboard.visibility = View.GONE
            }
            isEnabled -> {
                binding.tvKeyboardStatus.text = "Enabled but Not Selected"
                binding.tvKeyboardStatus.setTextColor(getColor(R.color.androiduse_orange))
                binding.btnEnableKeyboard.text = "Open Keyboard Settings"
                binding.btnSelectKeyboard.visibility = View.VISIBLE
            }
            else -> {
                binding.tvKeyboardStatus.text = "Not Enabled"
                binding.tvKeyboardStatus.setTextColor(getColor(R.color.androiduse_error))
                binding.btnEnableKeyboard.text = "Enable Keyboard"
                binding.btnSelectKeyboard.visibility = View.GONE
            }
        }
    }

    // ===== Keyboard Input Method =====

    private fun isKeyboardEnabled(): Boolean {
        val inputMethodManager = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
        val enabledInputMethods = inputMethodManager.enabledInputMethodList
        val borisKeyboardId = "$packageName/${AndroidUseKeyboardIME::class.java.canonicalName}"

        return enabledInputMethods.any { it.id == borisKeyboardId }
    }

    private fun isKeyboardSelected(): Boolean {
        val inputMethodManager = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
        val currentInputMethod = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.DEFAULT_INPUT_METHOD
        )
        val borisKeyboardId = "$packageName/${AndroidUseKeyboardIME::class.java.canonicalName}"

        return currentInputMethod == borisKeyboardId
    }

    private fun openKeyboardSettings() {
        try {
            startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open keyboard settings", e)
            Toast.makeText(this, "Failed to open keyboard settings", Toast.LENGTH_SHORT).show()
        }
    }

    private fun showKeyboardPicker() {
        try {
            val inputMethodManager = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
            inputMethodManager.showInputMethodPicker()
            Toast.makeText(
                this,
                "Select 'PhoneGPT Keyboard' from the list",
                Toast.LENGTH_LONG
            ).show()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to show keyboard picker", e)
            Toast.makeText(this, "Failed to show keyboard picker", Toast.LENGTH_SHORT).show()
        }
    }

    // ===== Accessibility Service =====

    private fun isAccessibilityServiceEnabled(): Boolean {
        val accessibilityServiceName =
            packageName + "/" + AndroidUseAccessibilityService::class.java.canonicalName

        try {
            val enabledServices = Settings.Secure.getString(
                contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            )
            return enabledServices?.contains(accessibilityServiceName) == true
        } catch (e: Exception) {
            Log.e(TAG, "Error checking accessibility service: ${e.message}")
            return false
        }
    }

    private fun openAccessibilitySettings() {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            startActivity(intent)
            Toast.makeText(
                this,
                "Please enable PhoneGPT accessibility service",
                Toast.LENGTH_LONG
            ).show()
        } catch (e: Exception) {
            Log.e(TAG, "Error opening accessibility settings: ${e.message}")
            Toast.makeText(this, "Error opening settings", Toast.LENGTH_SHORT).show()
        }
    }

    // ===== Notification Listener =====

    private fun isNotificationListenerEnabled(): Boolean {
        val packageName = packageName
        val flat = Settings.Secure.getString(
            contentResolver,
            "enabled_notification_listeners"
        )
        return flat?.contains(packageName) == true
    }

    private fun openNotificationSettings() {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            startActivity(intent)
            Toast.makeText(
                this,
                "Please grant Notification Access to PhoneGPT",
                Toast.LENGTH_LONG
            ).show()
        } catch (e: Exception) {
            Log.e(TAG, "Error opening notification settings: ${e.message}")
            Toast.makeText(this, "Error opening settings", Toast.LENGTH_SHORT).show()
        }
    }

    // ===== Floating Button =====

    private fun toggleFloatingButton(isEnabled: Boolean) {
        if (isEnabled) {
            // Reset dismissed state when re-enabling
            configManager.floatingButtonDismissed = false

            // Check if accessibility service is enabled first
            if (!isAccessibilityServiceEnabled()) {
                // Open accessibility settings
                Toast.makeText(
                    this,
                    "Please enable PhoneGPT accessibility service first",
                    Toast.LENGTH_LONG
                ).show()
                openAccessibilitySettings()
                // Temporarily uncheck until accessibility is granted
                binding.toggleFloatingButton.isChecked = false
                return
            }

            if (checkFloatingButtonPermission()) {
                // Check audio permission for speech recognition
                if (checkAudioPermission()) {
                    startFloatingButtonService()
                } else {
                    // Request audio permission
                    requestAudioPermission()
                    // Temporarily uncheck until permission is granted
                    binding.toggleFloatingButton.isChecked = false
                }
            } else {
                // Request overlay permission first
                requestOverlayPermission()
                // Temporarily uncheck until permission is granted
                binding.toggleFloatingButton.isChecked = false
            }
        } else {
            stopFloatingButtonService()
        }
    }

    private fun checkFloatingButtonPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(this)
        } else {
            true // Permission granted by default on older versions
        }
    }

    private fun requestOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName")
                )
                overlayPermissionLauncher.launch(intent)
            }
        }
    }

    private fun checkAudioPermission(): Boolean {
        // COMMENTED OUT: RECORD_AUDIO permission check
        // Uncomment below if you add RECORD_AUDIO to manifest and disable on-device recognition
        /*
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        */

        // Return true - app uses on-device recognition by default (no RECORD_AUDIO needed)
        return true
    }

    private fun requestAudioPermission() {
        // COMMENTED OUT: RECORD_AUDIO permission request
        // Uncomment below if you add RECORD_AUDIO to manifest and disable on-device recognition
        /*
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!checkAudioPermission()) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.RECORD_AUDIO),
                    REQUEST_CODE_AUDIO_PERMISSION
                )
            }
        }
        */
    }


    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            REQUEST_CODE_AUDIO_PERMISSION -> {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    // Audio permission granted, start service
                    if (checkFloatingButtonPermission()) {
                        syncFloatingButtonState()
                        if (binding.toggleFloatingButton.isChecked) {
                            startFloatingButtonService()
                        }
                    }
                } else {
                    // Permission denied, uncheck the toggle
                    binding.toggleFloatingButton.isChecked = false
                    Toast.makeText(
                        this,
                        "Audio permission is required for speech recognition",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
            REQUEST_CODE_MICROPHONE_PERMISSION -> {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    // Microphone permission granted, enable real-time voice
                    configManager.realtimeVoiceCommandEnabled = true
                    binding.toggleRealtimeVoice.isChecked = true
                    Log.d(TAG, "Real-time voice command enabled after permission granted")
                    Toast.makeText(
                        this,
                        "Real-time voice enabled. Speak during tasks to guide the agent.",
                        Toast.LENGTH_LONG
                    ).show()
                } else {
                    // Permission denied
                    binding.toggleRealtimeVoice.isChecked = false
                    Toast.makeText(
                        this,
                        "Microphone permission is required for real-time voice commands",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }

    private fun startFloatingButtonService() {
        try {
            val intent = Intent(this, FloatingButtonService::class.java)
            startService(intent)
            Log.d(TAG, "Floating button service started")
        } catch (e: Exception) {
            Log.e(TAG, "Error starting floating button service: ${e.message}", e)
            Toast.makeText(this, "Error starting floating button: ${e.message}", Toast.LENGTH_SHORT).show()
            binding.toggleFloatingButton.isChecked = false
        }
    }

    private fun stopFloatingButtonService() {
        try {
            val intent = Intent(this, FloatingButtonService::class.java)
            stopService(intent)
            Log.d(TAG, "Floating button service stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping floating button service: ${e.message}", e)
        }
    }

    private fun syncFloatingButtonState() {
        // Check if service is running by checking if it's in the running services list
        val isRunning = isServiceRunning(FloatingButtonService::class.java)
        val isDismissed = configManager.floatingButtonDismissed

        // Service is considered "enabled" only if running AND not dismissed
        binding.toggleFloatingButton.isChecked = isRunning && !isDismissed
    }

    private fun isServiceRunning(serviceClass: Class<*>): Boolean {
        val activityManager = getSystemService(ACTIVITY_SERVICE) as ActivityManager
        @Suppress("DEPRECATION")
        val runningServices = activityManager.getRunningServices(Integer.MAX_VALUE)
        return runningServices.any { it.service.className == serviceClass.name }
    }

    // ===== Backend WebSocket Service =====

    private fun bindBackendWebSocketService() {
        val connection = object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
                val binder = service as? BackendWebSocketService.LocalBinder
                boundBackendService = binder?.getService()
                Log.d(TAG, "Bound to BackendWebSocketService")

                // Update status after binding
                updateBackendWsStatus()
            }

            override fun onServiceDisconnected(name: ComponentName?) {
                boundBackendService = null
                Log.d(TAG, "Unbound from BackendWebSocketService")
                updateBackendWsStatus()
            }
        }

        backendWsServiceConnection = connection
        val intent = Intent(this, BackendWebSocketService::class.java)
        try {
            bindService(intent, connection, BIND_AUTO_CREATE)
        } catch (e: Exception) {
            Log.e(TAG, "Error binding to BackendWebSocketService: ${e.message}", e)
        }
    }
}
