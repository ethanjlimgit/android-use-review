package com.androiduse.autopilot.onboarding

import android.Manifest
import android.app.role.RoleManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import com.androiduse.autopilot.analytics.AnalyticsManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * ViewModel for onboarding flow
 * Manages state for permission checks and navigation between onboarding screens
 */
class OnboardingViewModel : ViewModel() {

    private lateinit var context: Context

    private val _state = MutableStateFlow(OnboardingState())
    val state: StateFlow<OnboardingState> = _state.asStateFlow()

    /**
     * Initialize ViewModel with context for permission checks
     */
    fun init(context: Context) {
        this.context = context.applicationContext
        updatePermissionStatus()
    }

    /**
     * Check if accessibility service is enabled
     */
    fun checkAccessibilityPermission(): Boolean {
        if (!::context.isInitialized) return false

        val serviceName = "${context.packageName}/com.androiduse.autopilot.service.AndroidUseAccessibilityService"
        val enabledServices = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        )
        val granted = enabledServices?.contains(serviceName) == true
        val previouslyGranted = _state.value.accessibilityGranted

        _state.value = _state.value.copy(accessibilityGranted = granted)

        // Track permission granted event (only if newly granted)
        if (granted && !previouslyGranted) {
            AnalyticsManager.capture(
                event = "accessibility_permission_granted"
            )
        }

        return granted
    }

    /**
     * Check if overlay permission is granted
     */
    fun checkOverlayPermission(): Boolean {
        if (!::context.isInitialized) return false

        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(context)
        } else {
            true
        }
        val previouslyGranted = _state.value.overlayGranted

        _state.value = _state.value.copy(overlayGranted = granted)

        // Track permission granted event (only if newly granted)
        if (granted && !previouslyGranted) {
            AnalyticsManager.capture(
                event = "overlay_permission_granted"
            )
        }

        return granted
    }

    /**
     * Check if speech recognition (microphone) permission is granted
     */
    fun checkRecognitionPermission(): Boolean {
        if (!::context.isInitialized) return false

        val granted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

        val previouslyGranted = _state.value.recognitionGranted

        _state.value = _state.value.copy(recognitionGranted = granted)

        // Track permission granted event (only if newly granted)
        if (granted && !previouslyGranted) {
            AnalyticsManager.capture(
                event = "recognition_permission_granted"
            )
        }

        return granted
    }

    /**
     * Check if app is set as default assistant
     */
    fun checkDefaultAssistant(): Boolean {
        if (!::context.isInitialized) return false

        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = context.getSystemService(Context.ROLE_SERVICE) as? RoleManager
            roleManager?.isRoleHeld(RoleManager.ROLE_ASSISTANT) == true
        } else {
            // For older versions, check assistant component
            val assistantComponent = Settings.Secure.getString(
                context.contentResolver,
                "assistant"
            )
            assistantComponent?.contains(context.packageName) == true
        }

        val previouslyGranted = _state.value.defaultAssistantSet

        _state.value = _state.value.copy(defaultAssistantSet = granted)

        // Track default assistant set event (only if newly set)
        if (granted && !previouslyGranted) {
            AnalyticsManager.capture(
                event = "default_assistant_set"
            )
        }

        return granted
    }

    /**
     * Update all permission statuses
     */
    fun updatePermissionStatus() {
        checkAccessibilityPermission()
        checkOverlayPermission()
        checkRecognitionPermission()
        checkDefaultAssistant()
    }

    /**
     * Navigate to the next step in the onboarding flow
     */
    fun navigateNext() {
        val currentStep = _state.value.currentStep

        val nextStep = when (currentStep) {
            OnboardingStep.WELCOME -> OnboardingStep.PRIVACY

            OnboardingStep.PRIVACY -> OnboardingStep.ACCESSIBILITY_INTRO

            OnboardingStep.ACCESSIBILITY_INTRO -> OnboardingStep.ACCESSIBILITY_GUIDE

            OnboardingStep.ACCESSIBILITY_GUIDE -> {
                // Check if we need to show step 2 of accessibility guide
                if (_state.value.accessibilityGuideStep == 1) {
                    _state.value = _state.value.copy(accessibilityGuideStep = 2)
                    return
                }
                // Move to overlay intro
                OnboardingStep.OVERLAY_INTRO
            }

            OnboardingStep.OVERLAY_INTRO -> OnboardingStep.OVERLAY_GUIDE

            OnboardingStep.OVERLAY_GUIDE -> {
                // Check if we need to show step 2 of overlay guide
                if (_state.value.overlayGuideStep == 1) {
                    _state.value = _state.value.copy(overlayGuideStep = 2)
                    return
                }
                // Move to recognition intro
                OnboardingStep.RECOGNITION_INTRO
            }

            OnboardingStep.RECOGNITION_INTRO -> OnboardingStep.RECOGNITION_GUIDE

            OnboardingStep.RECOGNITION_GUIDE -> {
                // Check if we need to show step 2 of recognition guide
                if (_state.value.recognitionGuideStep == 1) {
                    _state.value = _state.value.copy(recognitionGuideStep = 2)
                    return
                }
                // Move to default assistant
                OnboardingStep.DEFAULT_ASSISTANT
            }

            OnboardingStep.DEFAULT_ASSISTANT -> {
                // Track onboarding completed when moving to SUCCESS step
                AnalyticsManager.capture(
                    event = "onboarding_completed",
                    properties = mapOf(
                        "accessibility_granted" to _state.value.accessibilityGranted,
                        "overlay_granted" to _state.value.overlayGranted,
                        "recognition_granted" to _state.value.recognitionGranted
                    )
                )
                OnboardingStep.SUCCESS
            }

            OnboardingStep.SUCCESS -> return // Already at the end
        }

        _state.value = _state.value.copy(currentStep = nextStep)
    }

    /**
     * Navigate to the previous step in the onboarding flow
     */
    fun navigateBack(): Boolean {
        val currentStep = _state.value.currentStep

        // Handle multi-step guides
        when (currentStep) {
            OnboardingStep.ACCESSIBILITY_GUIDE -> {
                if (_state.value.accessibilityGuideStep == 2) {
                    _state.value = _state.value.copy(accessibilityGuideStep = 1)
                    return true
                }
            }
            OnboardingStep.OVERLAY_GUIDE -> {
                if (_state.value.overlayGuideStep == 2) {
                    _state.value = _state.value.copy(overlayGuideStep = 1)
                    return true
                }
            }
            OnboardingStep.RECOGNITION_GUIDE -> {
                if (_state.value.recognitionGuideStep == 2) {
                    _state.value = _state.value.copy(recognitionGuideStep = 1)
                    return true
                }
            }
            else -> {}
        }

        // Navigate to previous step
        val previousStep = when (currentStep) {
            OnboardingStep.WELCOME -> return false // Can't go back from welcome

            OnboardingStep.PRIVACY -> OnboardingStep.WELCOME

            OnboardingStep.ACCESSIBILITY_INTRO -> OnboardingStep.PRIVACY

            OnboardingStep.ACCESSIBILITY_GUIDE -> OnboardingStep.ACCESSIBILITY_INTRO

            OnboardingStep.OVERLAY_INTRO -> {
                // Reset accessibility guide steps when going back
                _state.value = _state.value.copy(accessibilityGuideStep = 1)
                OnboardingStep.ACCESSIBILITY_GUIDE
            }

            OnboardingStep.OVERLAY_GUIDE -> OnboardingStep.OVERLAY_INTRO

            OnboardingStep.RECOGNITION_INTRO -> {
                // Reset overlay guide steps when going back
                _state.value = _state.value.copy(overlayGuideStep = 1)
                OnboardingStep.OVERLAY_GUIDE
            }

            OnboardingStep.RECOGNITION_GUIDE -> OnboardingStep.RECOGNITION_INTRO

            OnboardingStep.DEFAULT_ASSISTANT -> {
                // Reset recognition guide steps when going back
                _state.value = _state.value.copy(recognitionGuideStep = 1)
                OnboardingStep.RECOGNITION_GUIDE
            }

            OnboardingStep.SUCCESS -> OnboardingStep.DEFAULT_ASSISTANT
        }

        _state.value = _state.value.copy(currentStep = previousStep)
        return true
    }

    /**
     * Check if all required permissions are granted
     */
    fun areRequiredPermissionsGranted(): Boolean {
        return _state.value.accessibilityGranted &&
               _state.value.overlayGranted &&
               _state.value.recognitionGranted
    }
}

/**
 * State for the onboarding flow
 */
data class OnboardingState(
    val currentStep: OnboardingStep = OnboardingStep.WELCOME,
    val accessibilityGranted: Boolean = false,
    val overlayGranted: Boolean = false,
    val recognitionGranted: Boolean = false,
    val defaultAssistantSet: Boolean = false,
    val accessibilityGuideStep: Int = 1,  // 1 or 2
    val overlayGuideStep: Int = 1,        // 1 or 2
    val recognitionGuideStep: Int = 1     // 1 or 2
)

/**
 * Steps in the onboarding flow
 */
enum class OnboardingStep {
    WELCOME,
    PRIVACY,
    ACCESSIBILITY_INTRO,
    ACCESSIBILITY_GUIDE,
    OVERLAY_INTRO,
    OVERLAY_GUIDE,
    RECOGNITION_INTRO,
    RECOGNITION_GUIDE,
    DEFAULT_ASSISTANT,
    SUCCESS
}
