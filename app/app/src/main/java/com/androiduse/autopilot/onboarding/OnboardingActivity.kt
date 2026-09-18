package com.androiduse.autopilot.onboarding

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import androidx.activity.OnBackPressedCallback
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.androiduse.autopilot.config.ConfigManager
import com.androiduse.autopilot.service.FloatingButtonService
import com.androiduse.autopilot.onboarding.fragments.AccessibilityGuideFragment
import com.androiduse.autopilot.onboarding.fragments.AccessibilityIntroFragment
import com.androiduse.autopilot.onboarding.fragments.DefaultAssistantFragment
import com.androiduse.autopilot.onboarding.fragments.OverlayGuideFragment
import com.androiduse.autopilot.onboarding.fragments.OverlayIntroFragment
import com.androiduse.autopilot.onboarding.fragments.RecognitionGuideFragment
import com.androiduse.autopilot.onboarding.fragments.RecognitionIntroFragment
import com.androiduse.autopilot.onboarding.fragments.PrivacyFragment
import com.androiduse.autopilot.onboarding.fragments.SuccessFragment
import com.androiduse.autopilot.onboarding.fragments.WelcomeFragment
import com.androiduse.autopilot.survey.SurveyActivity
import com.androiduse.autopilot.databinding.ActivityOnboardingBinding
import kotlinx.coroutines.launch

/**
 * Onboarding activity that guides users through required permissions setup
 * Shows a 9-screen linear flow on first launch
 */
class OnboardingActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "OnboardingActivity"
    }

    private lateinit var binding: ActivityOnboardingBinding
    private val viewModel: OnboardingViewModel by viewModels()
    private lateinit var configManager: ConfigManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize ConfigManager
        configManager = ConfigManager.Companion.getInstance(this)

        // Check if onboarding is already complete
        if (configManager.isOnboardingComplete) {
            navigateToNextActivity()
            return
        }

        binding = ActivityOnboardingBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Initialize ViewModel
        viewModel.init(this)

        // Load initial fragment if not already loaded
        if (savedInstanceState == null) {
            loadFragment(WelcomeFragment())
        }

        // Setup back button handling
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val handled = viewModel.navigateBack()
                if (!handled) {
                    // On welcome screen, exit app
                    finish()
                }
            }
        })

        // Observe state changes for navigation
        observeState()
    }

    override fun onResume() {
        super.onResume()
        // Update permission status when returning from Settings
        viewModel.updatePermissionStatus()
    }

    /**
     * Observe ViewModel state for navigation
     */
    private fun observeState() {
        lifecycleScope.launch {
            viewModel.state.collect { state ->
                handleStateChange(state)
            }
        }
    }

    /**
     * Handle state changes and navigate to appropriate fragment
     */
    private fun handleStateChange(state: OnboardingState) {
        val fragment = when (state.currentStep) {
            OnboardingStep.WELCOME -> WelcomeFragment()
            OnboardingStep.PRIVACY -> PrivacyFragment()
            OnboardingStep.ACCESSIBILITY_INTRO -> AccessibilityIntroFragment()
            OnboardingStep.ACCESSIBILITY_GUIDE -> AccessibilityGuideFragment()
            OnboardingStep.OVERLAY_INTRO -> OverlayIntroFragment()
            OnboardingStep.OVERLAY_GUIDE -> OverlayGuideFragment()
            OnboardingStep.RECOGNITION_INTRO -> RecognitionIntroFragment()
            OnboardingStep.RECOGNITION_GUIDE -> RecognitionGuideFragment()
            OnboardingStep.DEFAULT_ASSISTANT -> DefaultAssistantFragment()
            OnboardingStep.SUCCESS -> SuccessFragment()
        }

        loadFragment(fragment)
    }

    /**
     * Load a fragment into the container
     */
    private fun loadFragment(fragment: Fragment) {
        supportFragmentManager.beginTransaction()
            .replace(binding.fragmentContainer.id, fragment)
            .commit()
    }

    /**
     * Complete onboarding and navigate to appropriate activity
     */
    fun completeOnboarding() {
        configManager.isOnboardingComplete = true

        // Enable floating button by default after onboarding
        startFloatingButtonService()

        navigateToNextActivity()
    }

    /**
     * Start the floating button service if overlay permission is granted
     */
    private fun startFloatingButtonService() {
        try {
            // Check if overlay permission is granted
            if (!Settings.canDrawOverlays(this)) {
                Log.d(TAG, "Overlay permission not granted, skipping floating button start")
                return
            }

            // Ensure floating button is not marked as dismissed
            configManager.floatingButtonDismissed = false

            // Start the floating button service
            val intent = Intent(this, FloatingButtonService::class.java)
            startService(intent)
            Log.d(TAG, "FloatingButtonService started after onboarding")
        } catch (e: Exception) {
            Log.e(TAG, "Error starting FloatingButtonService: ${e.message}", e)
        }
    }

    /**
     * Navigate to the appropriate next activity
     * If survey is already complete, go to MainActivity
     * Otherwise, go to SurveyActivity
     */
    private fun navigateToNextActivity() {
        if (configManager.isSurveyComplete) {
            // Survey already completed - go directly to MainActivity
            navigateToMainActivity()
        } else {
            // Survey not completed - go to SurveyActivity
            navigateToSurveyActivity()
        }
    }

    /**
     * Navigate to SurveyActivity
     */
    private fun navigateToSurveyActivity() {
        val intent = Intent(this, SurveyActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }

    /**
     * Navigate to MainActivity
     */
    private fun navigateToMainActivity() {
        val intent = Intent(this, com.androiduse.autopilot.ui.MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }

}
