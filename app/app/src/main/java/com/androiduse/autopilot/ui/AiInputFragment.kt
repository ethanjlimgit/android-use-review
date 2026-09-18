package com.androiduse.autopilot.ui

import android.Manifest
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.androiduse.autopilot.analytics.AnalyticsManager
import com.androiduse.autopilot.config.ConfigManager
import com.androiduse.autopilot.paywall.StripePaymentActivity
import com.androiduse.autopilot.paywall.TaskLimitManager
import com.androiduse.autopilot.service.AndroidUseAccessibilityService
import com.androiduse.autopilot.service.BackendServiceInitializer
import com.androiduse.autopilot.service.BackendWebSocketService
import com.androiduse.autopilot.databinding.FragmentAiInputBinding
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Reusable AI Input Fragment
 *
 * Provides voice and text input functionality to submit tasks to the backend.
 * Used in both MainActivity and FloatingButtonService fullscreen overlay.
 */
class AiInputFragment : Fragment() {

    private var _binding: FragmentAiInputBinding? = null
    private val binding get() = _binding!!

    private lateinit var taskLimitManager: TaskLimitManager
    private lateinit var configManager: ConfigManager
    private var speechRecognizer: SpeechRecognizer? = null
    private var isListening = false

    // Callbacks for parent activities/services
    var onTaskSubmitted: ((String) -> Unit)? = null
    var onPaywallRequired: (() -> Unit)? = null
    var onPartialSpeechResult: ((String) -> Unit)? = null
    var onSpeechStarted: (() -> Unit)? = null
    var onSpeechEnded: (() -> Unit)? = null

    companion object {
        private const val TAG = "AiInputFragment"
        private const val REQUEST_CODE_AUDIO_PERMISSION = 1003

        fun newInstance(): AiInputFragment {
            return AiInputFragment()
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentAiInputBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        taskLimitManager = TaskLimitManager.Companion.getInstance(requireContext())
        configManager = ConfigManager.Companion.getInstance(requireContext())
        setupSpeechRecognition()
        setupInputUI()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        speechRecognizer?.destroy()
        speechRecognizer = null
        _binding = null
    }

    // ==================== Setup Methods ====================

    /**
     * Setup speech recognition
     * Uses cloud-based recognition for better accuracy
     */
    private fun setupSpeechRecognition() {
        if (!SpeechRecognizer.isRecognitionAvailable(requireContext())) {
            Log.w(TAG, "Speech recognition not available")
            return
        }

        Log.d(TAG, "Setting up cloud-based speech recognition")
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(requireContext())

        speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    isListening = true
                    updateMicButtonState(true)
                    onSpeechStarted?.invoke()
                    Log.d(TAG, "Ready for speech")
                }

                override fun onBeginningOfSpeech() {
                    onPartialSpeechResult?.invoke("Listening...")
                }

                override fun onResults(results: Bundle?) {
                    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    matches?.firstOrNull()?.let { text ->
                        onPartialSpeechResult?.invoke(text)
                        binding.instructionInput.setText(text)
                        // Hide partial text after a brief delay before submitting
                        lifecycleScope.launch {
                            delay(500)
                            onSpeechEnded?.invoke()
                            submitTask(text)
                        }
                    }
                    isListening = false
                    updateMicButtonState(false)
                }

                override fun onError(error: Int) {
                    isListening = false
                    updateMicButtonState(false)

                    val errorMsg = when (error) {
                        SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
                        SpeechRecognizer.ERROR_CLIENT -> "Client error"
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
                        SpeechRecognizer.ERROR_NETWORK -> "Network error"
                        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
                        SpeechRecognizer.ERROR_NO_MATCH -> "No speech match"
                        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognition service busy"
                        SpeechRecognizer.ERROR_SERVER -> "Server error"
                        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech input"
                        else -> "Unknown error"
                    }
                    Log.e(TAG, "Speech recognition error: $errorMsg")

                    // Only show toast for actual errors (not timeouts or no match)
                    if (error != SpeechRecognizer.ERROR_SPEECH_TIMEOUT &&
                        error != SpeechRecognizer.ERROR_NO_MATCH) {
                        Toast.makeText(requireContext(), "Voice recognition failed", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {
                    isListening = false
                    updateMicButtonState(false)
                }
                override fun onPartialResults(partialResults: Bundle?) {
                    val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    matches?.firstOrNull()?.let { text ->
                        onPartialSpeechResult?.invoke(text)
                    }
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
    }

    /**
     * Setup input UI (buttons and text field)
     */
    private fun setupInputUI() {
        // Combined action button - mic when empty, send when text exists
        binding.actionButton.setOnClickListener {
            val text = binding.instructionInput.text?.toString()?.trim() ?: ""
            if (text.isNotBlank()) {
                // Send mode - submit task
                submitTask(text)
            } else {
                // Mic mode - start voice input
                onMicButtonClicked()
            }
        }

        // Keyboard send action
        binding.instructionInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                val text = binding.instructionInput.text?.toString()?.trim() ?: ""
                if (text.isNotBlank()) {
                    submitTask(text)
                }
                true
            } else {
                false
            }
        }

        // Text change listener to toggle between mic/send icon
        binding.instructionInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                updateActionButtonState(!s.isNullOrBlank())
            }
        })
    }

    /**
     * Update action button to show mic or send icon
     */
    private fun updateActionButtonState(hasText: Boolean) {
        if (hasText) {
            binding.micIcon.visibility = View.GONE
            binding.sendIcon.visibility = View.VISIBLE
        } else {
            binding.micIcon.visibility = View.VISIBLE
            binding.sendIcon.visibility = View.GONE
        }
    }

    // ==================== Action Handlers ====================

    /**
     * Handle microphone button click
     */
    private fun onMicButtonClicked() {
        if (isListening) {
            stopSpeechRecognition()
            return
        }

        // Check permission (required for both on-device and cloud-based recognition)
        if (ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                requireActivity(),
                arrayOf(Manifest.permission.RECORD_AUDIO),
                REQUEST_CODE_AUDIO_PERMISSION
            )
            return
        }

        startSpeechRecognition()
    }

    /**
     * Start speech recognition
     */
    private fun startSpeechRecognition() {
        // Get configured language or use device default
        val configuredLanguage = configManager.speechLanguage
        val language = if (configuredLanguage.isNotEmpty()) {
            configuredLanguage
        } else {
            Locale.getDefault().toLanguageTag()
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }

        try {
            speechRecognizer?.startListening(intent)
            Log.d(TAG, "Starting speech recognition (language: $language)")
            Toast.makeText(requireContext(), "Listening...", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Log.e(TAG, "Error starting speech recognition: ${e.message}", e)
            Toast.makeText(requireContext(), "Failed to start voice recognition", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Stop speech recognition
     */
    private fun stopSpeechRecognition() {
        speechRecognizer?.stopListening()
        isListening = false
        updateMicButtonState(false)
    }

    /**
     * Submit task to backend
     */
    private fun submitTask(instruction: String) {
        if (instruction.isBlank()) {
            Toast.makeText(requireContext(), "Please enter a task", Toast.LENGTH_SHORT).show()
            return
        }

        // 1. Check required permissions
        if (!isAccessibilityServiceEnabled()) {
            showPermissionRequiredDialog(
                "Accessibility Service Required",
                "Please enable the accessibility service to submit tasks."
            )
            return
        }

        if (!isOverlayPermissionGranted()) {
            showPermissionRequiredDialog(
                "Overlay Permission Required",
                "Please enable overlay permission to submit tasks."
            )
            return
        }

        // 2. Check credit limit
        if (taskLimitManager.hasReachedLimit()) {
            Log.w(TAG, "Credit limit reached (${taskLimitManager.creditsUsed}/${taskLimitManager.creditAllowance})")

            // Track credit limit hit event
            AnalyticsManager.capture(
                event = "credit_limit_reached",
                properties = mapOf(
                    "credits_used" to taskLimitManager.creditsUsed,
                    "credit_allowance" to taskLimitManager.creditAllowance,
                    "usage_percentage" to taskLimitManager.getCreditUsagePercentage()
                )
            )

            onPaywallRequired?.invoke() ?: showPaywall()
            return
        }

        // 2. Ensure backend is connected
        Log.d(TAG, "Submitting task - checking backend connection")
        BackendServiceInitializer.ensureConnected()

        // Check backend connection
        val backendService = BackendWebSocketService.Companion.getInstance()
        if (backendService == null) {
            Toast.makeText(requireContext(), "Backend not connected", Toast.LENGTH_SHORT).show()
            Log.w(TAG, "Backend service not available")
            return
        }

        // Verify connection status
        val status = backendService.getConnectionStatus()
        if (status != "Connected") {
            Log.w(TAG, "Backend not connected (status: $status), attempting to reconnect")
            Toast.makeText(requireContext(), "Connecting to backend...", Toast.LENGTH_SHORT).show()
            BackendServiceInitializer.ensureConnected()
        }

        // 3. Submit task via coroutine
        lifecycleScope.launch {
            try {
                // Check if real-time voice command is enabled
                val voiceCommandEnabled = configManager.realtimeVoiceCommandEnabled
                val taskId = backendService.submitTask(instruction, voiceCommandEnabled)

                if (voiceCommandEnabled) {
                    Log.d(TAG, "Task submitted with real-time voice enabled")
                }

                if (taskId != null) {
                    // Note: Credit usage is tracked server-side automatically

                    // 4. Update global task state
                    TaskStateManager.startTask(taskId, instruction)

                    // 5. Track task submission
                    AnalyticsManager.capture(
                        event = "task_submitted",
                        properties = mapOf(
                            "task_id" to taskId,
                            "instruction_length" to instruction.length,
                            "credits_used" to taskLimitManager.creditsUsed,
                            "credit_allowance" to taskLimitManager.creditAllowance,
                            "input_method" to if (isListening) "voice" else "text"
                        )
                    )

                    // 6. Clear input
                    binding.instructionInput.text?.clear()

                    // 7. Notify parent
                    onTaskSubmitted?.invoke(taskId)

                    Toast.makeText(
                        requireContext(),
                        "Task received!",
                        Toast.LENGTH_SHORT
                    ).show()

                    Log.d(TAG, "Task submitted successfully: $taskId (credits: ${taskLimitManager.creditsUsed}/${taskLimitManager.creditAllowance})")
                } else {
                    Toast.makeText(
                        requireContext(),
                        "Failed to submit task",
                        Toast.LENGTH_SHORT
                    ).show()
                    Log.e(TAG, "Failed to submit task - no task ID returned")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error submitting task: ${e.message}", e)
                Toast.makeText(
                    requireContext(),
                    "Error: ${e.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    /**
     * Show paywall activity
     */
    private fun showPaywall() {
        try {
            val intent = Intent(requireContext(), StripePaymentActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error opening paywall: ${e.message}", e)
            Toast.makeText(requireContext(), "Error opening paywall", Toast.LENGTH_SHORT).show()
        }
    }

    // ==================== Permission Checks ====================

    /**
     * Check if accessibility service is enabled
     */
    private fun isAccessibilityServiceEnabled(): Boolean {
        val serviceName = "${requireContext().packageName}/${AndroidUseAccessibilityService::class.java.canonicalName}"
        val enabledServices = Settings.Secure.getString(
            requireContext().contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        )
        return enabledServices?.contains(serviceName) == true
    }

    /**
     * Check if overlay permission is granted
     */
    private fun isOverlayPermissionGranted(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(requireContext())
        } else {
            true // Permission not required on older versions
        }
    }

    /**
     * Show dialog when permission is required and redirect to settings
     */
    private fun showPermissionRequiredDialog(title: String, message: String) {
        AlertDialog.Builder(requireContext())
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Go to Settings") { _, _ ->
                // Determine which settings screen to open based on the title
                val intent = when {
                    title.contains("Accessibility", ignoreCase = true) -> {
                        Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                    }
                    title.contains("Overlay", ignoreCase = true) -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            Intent(
                                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                Uri.parse("package:${requireContext().packageName}")
                            )
                        } else {
                            Intent(Settings.ACTION_SETTINGS)
                        }
                    }
                    else -> Intent(Settings.ACTION_SETTINGS)
                }
                startActivity(intent)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    // ==================== UI Updates ====================

    /**
     * Update microphone button state (listening or not)
     */
    private fun updateMicButtonState(listening: Boolean) {
        if (listening) {
            // Change to stop icon when listening
            binding.micIcon.setImageResource(com.androiduse.autopilot.R.drawable.ic_close)
            binding.sendIcon.visibility = View.GONE
            binding.micIcon.visibility = View.VISIBLE
        } else {
            // Change back to mic icon when not listening
            binding.micIcon.setImageResource(com.androiduse.autopilot.R.drawable.ic_mic)
            // Restore based on text state
            val hasText = !binding.instructionInput.text.isNullOrBlank()
            updateActionButtonState(hasText)
        }
    }

    // ==================== Public API ====================

    /**
     * Set the input text programmatically
     */
    fun setInputText(text: String) {
        binding.instructionInput.setText(text)
    }

    /**
     * Get the current input text
     */
    fun getInputText(): String {
        return binding.instructionInput.text?.toString()?.trim() ?: ""
    }

    /**
     * Clear the input text
     */
    fun clearInput() {
        binding.instructionInput.text?.clear()
    }

    /**
     * Set the input text and immediately submit the task
     */
    fun setInputTextAndSubmit(text: String) {
        binding.instructionInput.setText(text)
        submitTask(text)
    }

    /**
     * Handle permission result from parent activity
     */
    fun handlePermissionResult(granted: Boolean) {
        if (granted) {
            startSpeechRecognition()
        } else {
            Toast.makeText(
                requireContext(),
                "Microphone permission is required for voice input",
                Toast.LENGTH_LONG
            ).show()
        }
    }
}
