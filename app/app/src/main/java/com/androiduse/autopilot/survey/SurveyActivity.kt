package com.androiduse.autopilot.survey

import android.content.Intent
import android.os.Bundle
import androidx.activity.OnBackPressedCallback
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.androiduse.autopilot.auth.SessionManager
import com.androiduse.autopilot.auth.ui.AuthActivity
import com.androiduse.autopilot.config.ConfigManager
import com.androiduse.autopilot.survey.fragments.CompanySizeFragment
import com.androiduse.autopilot.survey.fragments.IndustryFragment
import com.androiduse.autopilot.survey.fragments.PersonalizingFragment
import com.androiduse.autopilot.survey.fragments.RoleFragment
import com.androiduse.autopilot.survey.fragments.UseCaseFragment
import com.androiduse.autopilot.survey.fragments.UserTypeFragment
import com.androiduse.autopilot.ui.MainActivity
import com.androiduse.autopilot.databinding.ActivitySurveyBinding
import com.androiduse.autopilot.survey.fragments.*
import kotlinx.coroutines.launch

/**
 * Survey activity that collects user information after onboarding
 * Shows a 6-screen survey flow with email-based branching logic
 */
class SurveyActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySurveyBinding
    private val viewModel: SurveyViewModel by viewModels()
    private lateinit var configManager: ConfigManager
    private lateinit var sessionManager: SessionManager
    private var currentLoadedStep: SurveyStep? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize managers
        configManager = ConfigManager.Companion.getInstance(this)
        sessionManager = SessionManager(this)

        // Check if survey is already complete
        if (configManager.isSurveyComplete) {
            navigateToMainActivity()
            return
        }

        // Get user (may be null for guest users)
        val user = sessionManager.getUser()

        binding = ActivitySurveyBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Initialize ViewModel
        viewModel.init(this)

        // Setup back button handling
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val handled = viewModel.navigateBack()
                if (!handled) {
                    // On first screen, exit to previous activity
                    finish()
                }
            }
        })

        // Observe state changes for navigation (must be before determineStartScreen)
        observeState()

        // Determine start screen based on email domain
        // Guest users (null user or no email) are treated as personal users
        // This updates the state, which triggers the observer to load the fragment
        if (savedInstanceState == null) {
            viewModel.determineStartScreen(user?.email)
        }
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
    private fun handleStateChange(state: SurveyState) {
        // Only reload fragment if the step has changed
        if (currentLoadedStep != state.currentStep) {
            currentLoadedStep = state.currentStep
            loadFragmentForStep(state.currentStep)
        }
    }

    /**
     * Load fragment for the given step
     */
    private fun loadFragmentForStep(step: SurveyStep) {
        val fragment = when (step) {
            SurveyStep.USER_TYPE -> UserTypeFragment()
            SurveyStep.COMPANY_SIZE -> CompanySizeFragment()
            SurveyStep.INDUSTRY -> IndustryFragment()
            SurveyStep.ROLE -> RoleFragment()
            SurveyStep.USE_CASE -> UseCaseFragment()
            SurveyStep.PERSONALIZING -> PersonalizingFragment()
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
     * Complete survey and navigate to MainActivity
     */
    fun completeSurvey() {
        navigateToMainActivity()
    }

    /**
     * Navigate to MainActivity
     */
    private fun navigateToMainActivity() {
        val intent = Intent(this, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }

    /**
     * Navigate to AuthActivity
     */
    private fun navigateToAuthActivity() {
        val intent = Intent(this, AuthActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }

}
