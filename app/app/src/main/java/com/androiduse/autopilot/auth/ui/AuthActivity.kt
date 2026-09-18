package com.androiduse.autopilot.auth.ui

import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.androiduse.autopilot.auth.AuthViewModel
import com.androiduse.autopilot.auth.SessionManager
import com.androiduse.autopilot.auth.api.RetrofitClient
import com.androiduse.autopilot.auth.model.AuthResult
import com.androiduse.autopilot.config.ConfigManager
import com.androiduse.autopilot.onboarding.OnboardingActivity
import com.androiduse.autopilot.paywall.TaskLimitManager
import com.androiduse.autopilot.survey.SurveyActivity
import com.androiduse.autopilot.ui.MainActivity
import com.androiduse.autopilot.BuildConfig
import com.androiduse.autopilot.R
import com.androiduse.autopilot.databinding.ActivityAuthBinding
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.launch

class AuthActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAuthBinding
    private val viewModel: AuthViewModel by viewModels()
    private lateinit var configManager: ConfigManager

    private var isSignUpMode = false
    private var referralCode: String? = null

    /**
     * Activity result launcher for OAuth flow
     */
    private val oauthLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        // The result will be handled via deep link
        // This callback is just for cleanup
    }

    /**
     * Activity result launcher for legacy Google Sign-In fallback
     */
    private val legacyGoogleSignInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        lifecycleScope.launch {
            val authResult = viewModel.handleLegacyGoogleSignInResult(result.data)
            // The result will be processed by the existing observeAuthState flow
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Check if user is already authenticated
        val sessionManager = SessionManager(this)
        if (sessionManager.isAuthenticated()) {
            // User is already signed in, navigate directly to appropriate screen
            // (navigateToMainActivity handles routing to Onboarding/Survey/Main based on completion status)
            configManager = ConfigManager.Companion.getInstance(this)
            navigateToMainActivity()
            return
        }

        // User is not authenticated, show auth screen
        binding = ActivityAuthBinding.inflate(layoutInflater)
        setContentView(binding.root)

        configManager = ConfigManager.Companion.getInstance(this)
        setupUI()
        setupLegacyGoogleSignInCallback()
        loadSavedEnvironment()
        ensureWebSocketAlwaysEnabled()
        observeAuthState()
        handleDeepLink(intent)

        // Check for referral code in intent
        handleReferralDeepLink(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
        handleReferralDeepLink(intent)
    }

    /**
     * Setup UI click listeners
     */
    private fun setupUI() {
        // Hide environment selector and skip login for production and staging
        val isProdOrStaging = BuildConfig.DEFAULT_ENVIRONMENT == "production" ||
                              BuildConfig.DEFAULT_ENVIRONMENT == "staging"

        if (isProdOrStaging) {
            // Hide "Continue Without Login" button for prod and staging
            binding.btnSkipLogin.visibility = View.GONE
            // Hide backend configuration card for prod and staging
            binding.cardBackendConfig.visibility = View.GONE
        } else {
            binding.btnSkipLogin.visibility = View.VISIBLE
            binding.cardBackendConfig.visibility = View.VISIBLE
        }

        // Environment selector
        binding.rgEnvironment.setOnCheckedChangeListener { _, checkedId ->
            handleEnvironmentChange(checkedId)
        }

        // Skip Login Button
        binding.btnSkipLogin.setOnClickListener {
            updateServerConfiguration()
            navigateToMainActivity()
        }

        // Email/Password Auth
        binding.btnEmailAuth.setOnClickListener {
            updateServerConfiguration()
            handleEmailPasswordAuth()
        }

        // Toggle between Sign In and Sign Up
        binding.tvToggleAuthMode.setOnClickListener {
            toggleAuthMode()
        }

        // Forgot Password
        binding.tvForgotPassword.setOnClickListener {
            updateServerConfiguration()
            showForgotPasswordDialog()
        }

        // Resend Verification Email
        binding.tvResendVerification.setOnClickListener {
            updateServerConfiguration()
            showResendVerificationDialog()
        }

        // Google Sign In
        binding.btnSignInGoogle.setOnClickListener {
            updateServerConfiguration()
            viewModel.signInWithGoogle(this)
        }

        // GitHub Sign In (Hidden)
        // binding.btnSignInGitHub.setOnClickListener {
        //     updateServerConfiguration()
        //     viewModel.signInWithGitHub(oauthLauncher)
        // }

        // Twitter Sign In (Hidden)
        // binding.btnSignInTwitter.setOnClickListener {
        //     updateServerConfiguration()
        //     viewModel.signInWithTwitter(oauthLauncher)
        // }
    }

    /**
     * Handle environment selection change
     */
    private fun handleEnvironmentChange(checkedId: Int) {
        when (checkedId) {
            binding.rbDev.id -> {
                // Show dev configuration fields
                binding.layoutDevConfig.visibility = View.VISIBLE
            }
            binding.rbStaging.id, binding.rbProduction.id -> {
                // Hide dev configuration fields
                binding.layoutDevConfig.visibility = View.GONE
            }
        }
    }

    /**
     * Ensure WebSocket connection is always enabled
     */
    private fun ensureWebSocketAlwaysEnabled() {
        // WebSocket (event server) should always be enabled
        if (!configManager.websocketEnabled) {
            configManager.websocketEnabled = true
        }

        // Backend WebSocket client should always be enabled
        if (!configManager.backendWsEnabled) {
            configManager.backendWsEnabled = true
        }
    }

    /**
     * Load saved environment from ConfigManager
     */
    private fun loadSavedEnvironment() {
        // Force correct environment for prod/staging builds to override old preferences
        val buildEnvironment = BuildConfig.DEFAULT_ENVIRONMENT
        if (buildEnvironment == "production" || buildEnvironment == "staging") {
            // Production/staging builds must use their configured environment
            configManager.serverEnvironment = buildEnvironment

            // Directly configure URLs from BuildConfig (don't rely on radio buttons)
            val authUrl = BuildConfig.DEFAULT_AUTH_URL
            val wsHost = BuildConfig.DEFAULT_WS_HOST
            val wsPort = BuildConfig.DEFAULT_WS_PORT

            configManager.authServerUrl = authUrl
            configManager.backendWsHost = wsHost
            configManager.backendWsPort = wsPort
            configManager.backendWsEnabled = true

            // Update RetrofitClient with correct URL
            RetrofitClient.setBaseUrlAndPersist(authUrl, this)

            Log.d("AuthActivity", "Forced $buildEnvironment environment: authUrl=$authUrl, wsHost=$wsHost")
        }

        val environment = configManager.serverEnvironment
        when (environment) {
            "dev" -> {
                binding.rbDev.isChecked = true
                binding.layoutDevConfig.visibility = View.VISIBLE
                // Load saved dev config
                binding.etAuthServerUrl.setText(configManager.authServerUrl)
                binding.etWsServerHost.setText(configManager.backendWsHost)
                binding.etWsServerPort.setText(configManager.backendWsPort.toString())
            }
            "staging" -> {
                binding.rbStaging.isChecked = true
                binding.layoutDevConfig.visibility = View.GONE
            }
            "production" -> {
                binding.rbProduction.isChecked = true
                binding.layoutDevConfig.visibility = View.GONE
            }
        }
    }

    /**
     * Handle email/password authentication
     */
    private fun handleEmailPasswordAuth() {
        val email = binding.etEmail.text?.toString()?.trim() ?: ""
        val password = binding.etPassword.text?.toString() ?: ""
        val name = binding.etName.text?.toString()?.trim()

        // Clear previous errors
        binding.layoutEmail.error = null
        binding.layoutPassword.error = null

        // Validate inputs
        if (isSignUpMode) {
            // Sign Up validation
            val emailValidation = viewModel.validateEmail(email)
            if (!emailValidation.isValid) {
                binding.layoutEmail.error = emailValidation.error
                return
            }

            val passwordValidation = viewModel.validatePassword(password)
            if (!passwordValidation.isValid) {
                binding.layoutPassword.error = passwordValidation.error
                return
            }

            // Perform sign up
            viewModel.signUpWithEmail(email, password, name)
        } else {
            // Sign In validation (basic)
            if (email.isBlank()) {
                binding.layoutEmail.error = "Email is required"
                return
            }

            if (password.isBlank()) {
                binding.layoutPassword.error = "Password is required"
                return
            }

            // Perform sign in
            viewModel.signInWithEmail(email, password)
        }
    }

    /**
     * Toggle between Sign In and Sign Up modes
     */
    private fun toggleAuthMode() {
        isSignUpMode = !isSignUpMode

        if (isSignUpMode) {
            // Switch to Sign Up mode
            binding.tvEmailAuthTitle.text = "Sign Up"
            binding.btnEmailAuth.text = "Sign Up"
            binding.tvToggleAuthMode.text = "Already have an account? Sign In"
            binding.layoutName.visibility = View.VISIBLE
            binding.tvForgotPassword.visibility = View.GONE
        } else {
            // Switch to Sign In mode
            binding.tvEmailAuthTitle.text = "Sign In"
            binding.btnEmailAuth.text = "Sign In"
            binding.tvToggleAuthMode.text = "Don't have an account? Sign Up"
            binding.layoutName.visibility = View.GONE
            binding.tvForgotPassword.visibility = View.VISIBLE
        }

        // Clear fields and errors
        binding.etEmail.text?.clear()
        binding.etPassword.text?.clear()
        binding.etName.text?.clear()
        binding.layoutEmail.error = null
        binding.layoutPassword.error = null
        binding.layoutName.error = null
    }

    /**
     * Show forgot password dialog
     */
    private fun showForgotPasswordDialog() {
        val emailInput = TextInputEditText(this)
        emailInput.hint = "Email"
        emailInput.inputType = InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS

        // Pre-fill with current email if available
        val currentEmail = binding.etEmail.text?.toString()?.trim()
        if (!currentEmail.isNullOrBlank()) {
            emailInput.setText(currentEmail)
        }

        val inputLayout = TextInputLayout(this)
        inputLayout.addView(emailInput)
        inputLayout.setPadding(
            resources.getDimensionPixelSize(R.dimen.app_icon_size) / 4,
            0,
            resources.getDimensionPixelSize(R.dimen.app_icon_size) / 4,
            0
        )

        AlertDialog.Builder(this)
            .setTitle("Reset Password")
            .setMessage("Enter your email address to receive a password reset link.")
            .setView(inputLayout)
            .setPositiveButton("Send Reset Link") { dialog, _ ->
                val email = emailInput.text?.toString()?.trim() ?: ""
                if (email.isNotBlank()) {
                    viewModel.forgotPassword(email)
                } else {
                    Toast.makeText(this, "Please enter your email", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    /**
     * Show resend verification email dialog
     */
    private fun showResendVerificationDialog() {
        val emailInput = TextInputEditText(this)
        emailInput.hint = "Email"
        emailInput.inputType = InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS

        // Pre-fill with current email if available
        val currentEmail = binding.etEmail.text?.toString()?.trim()
        if (!currentEmail.isNullOrBlank()) {
            emailInput.setText(currentEmail)
        }

        val inputLayout = TextInputLayout(this)
        inputLayout.addView(emailInput)
        inputLayout.setPadding(
            resources.getDimensionPixelSize(R.dimen.app_icon_size) / 4,
            0,
            resources.getDimensionPixelSize(R.dimen.app_icon_size) / 4,
            0
        )

        AlertDialog.Builder(this)
            .setTitle("Resend Verification Email")
            .setMessage("Enter your email address to receive a new verification link.")
            .setView(inputLayout)
            .setPositiveButton("Resend Email") { dialog, _ ->
                val email = emailInput.text?.toString()?.trim() ?: ""
                if (email.isNotBlank()) {
                    viewModel.resendVerificationEmail(email)
                } else {
                    Toast.makeText(this, "Please enter your email", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    /**
     * Show email verification dialog after successful signup
     */
    private fun showEmailVerificationDialog(message: String, email: String) {
        AlertDialog.Builder(this)
            .setTitle("Verify Your Email")
            .setMessage(message + "\n\nPlease check your email inbox (and spam folder) to verify your account.")
            .setPositiveButton("Resend Email") { _, _ ->
                viewModel.resendVerificationEmail(email)
            }
            .setNegativeButton("OK", null)
            .setCancelable(false)
            .show()
    }

    /**
     * Observe authentication state changes
     */
    /**
     * Setup callback for legacy Google Sign-In fallback
     */
    private fun setupLegacyGoogleSignInCallback() {
        viewModel.setLegacySignInCallback { intent ->
            Log.d("AuthActivity", "Launching legacy Google Sign-In intent")
            legacyGoogleSignInLauncher.launch(intent)
        }
    }

    private fun observeAuthState() {
        lifecycleScope.launch {
            viewModel.authState.collect { state ->
                handleAuthState(state)
            }
        }
    }

    /**
     * Handle authentication state changes
     */
    private fun handleAuthState(state: AuthResult) {
        when (state) {
            is AuthResult.Loading -> {
                showLoading(true)
                showStatus("Signing in...")
            }
            is AuthResult.Success -> {
                showLoading(false)
                showStatus("Sign in successful! Welcome ${state.user.name ?: state.user.email}")

                // Sync credit usage from server after login
                lifecycleScope.launch {
                    try {
                        val taskLimitManager = TaskLimitManager.Companion.getInstance(this@AuthActivity)
                        val syncSuccess = taskLimitManager.syncFromServer()

                        if (syncSuccess) {
                            Log.d("AuthActivity", "Credit usage synced: ${taskLimitManager.creditsUsed}/${taskLimitManager.creditAllowance}")
                        } else {
                            Log.w("AuthActivity", "Credit usage sync failed, using cached data")
                        }
                    } catch (e: Exception) {
                        Log.e("AuthActivity", "Error syncing credit usage: ${e.message}", e)
                    }

                    // Navigate AFTER sync attempt (don't block on failure)
                    navigateToMainActivity()
                }
            }
            is AuthResult.SignUpPending -> {
                showLoading(false)
                showStatus(state.message)

                // Get the email from the input field
                val email = binding.etEmail.text?.toString()?.trim() ?: ""

                // Show verification dialog for signup, toast for other pending actions
                if (state.userId.isNotEmpty()) {
                    // This is from signup - show dialog
                    showEmailVerificationDialog(state.message, email)

                    // Switch back to sign-in mode and show resend verification option
                    if (isSignUpMode) {
                        toggleAuthMode()
                    }
                    binding.tvResendVerification.visibility = View.VISIBLE
                } else {
                    // This is from resend or forgot password - show toast
                    Toast.makeText(this, state.message, Toast.LENGTH_LONG).show()
                }
            }
            is AuthResult.Error -> {
                // Check if this is the special "pending legacy sign-in" state
                if (state.message == "LEGACY_SIGNIN_PENDING") {
                    // Don't show error - the legacy flow is in progress
                    showLoading(true)
                    showStatus("Launching Google Sign-In...")
                    Log.d("AuthActivity", "Legacy Google Sign-In flow initiated")
                } else {
                    showLoading(false)
                    showStatus("Error: ${state.message}")

                    // Check if this is an "account already exists" error during sign-up
                    if (isSignUpMode && state.message.contains("already exists", ignoreCase = true)) {
                        // Switch to sign-in mode
                        toggleAuthMode()
                        Toast.makeText(this, state.message, Toast.LENGTH_LONG).show()
                        Log.d("AuthActivity", "Account exists - switched to sign-in mode")
                    } else {
                        Toast.makeText(this, "Authentication failed: ${state.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
            is AuthResult.NotAuthenticated -> {
                showLoading(false)
                hideStatus()
            }
        }
    }

    /**
     * Handle OAuth deep link callback
     */
    private fun handleDeepLink(intent: Intent?) {
        val data = intent?.data
        if (data != null && data.scheme == "androiduse" && data.host == "oauth") {
            // This is an OAuth callback
            viewModel.handleOAuthCallback(intent)
        }
    }

    /**
     * Handle referral deep link
     * Extracts referral code from URLs like https://androiduse.com/ref/ABC12345
     */
    private fun handleReferralDeepLink(intent: Intent?) {
        val data = intent?.data ?: return

        // Check if this is a referral link
        if (data.scheme == "https" &&
            (data.host == "androiduse.com" || data.host == "dev.androiduse.com") &&
            data.path?.startsWith("/ref/") == true) {

            // Extract referral code from path (e.g., /ref/ABC12345 -> ABC12345)
            val code = data.path?.removePrefix("/ref/")?.trim()

            if (!code.isNullOrEmpty() && code.length == 8) {
                referralCode = code
                viewModel.setReferralCode(code)

                // Switch to sign-up mode when coming from referral link
                if (!isSignUpMode) {
                    toggleAuthMode()
                }

                Log.d("AuthActivity", "Referral code extracted from deep link: $code")
                Toast.makeText(this, "Welcome! Sign up to get started", Toast.LENGTH_SHORT).show()
            }
        }
    }

    /**
     * Update server configuration based on selected environment
     */
    private fun updateServerConfiguration() {
        val environment = when (binding.rgEnvironment.checkedRadioButtonId) {
            binding.rbDev.id -> "dev"
            binding.rbStaging.id -> "staging"
            binding.rbProduction.id -> "production"
            else -> "production"
        }

        configManager.serverEnvironment = environment

        when (environment) {
            "dev" -> {
                // Get custom dev configuration from user input
                val authUrl = binding.etAuthServerUrl.text?.toString()?.trim() ?: BuildConfig.DEFAULT_AUTH_URL
                val wsHost = binding.etWsServerHost.text?.toString()?.trim() ?: BuildConfig.DEFAULT_WS_HOST
                val wsPort = binding.etWsServerPort.text?.toString()?.toIntOrNull() ?: BuildConfig.DEFAULT_WS_PORT

                // Save all configuration to ConfigManager
                configManager.authServerUrl = authUrl
                configManager.backendWsHost = wsHost
                configManager.backendWsPort = wsPort
                configManager.backendWsEnabled = true

                // Update RetrofitClient with new URL (also persisted internally)
                RetrofitClient.setBaseUrlAndPersist(authUrl, this)
            }
            "staging" -> {
                // Use BuildConfig values from staging flavor
                val authUrl = BuildConfig.DEFAULT_AUTH_URL  // https://dev.androiduse.com
                val wsHost = BuildConfig.DEFAULT_WS_HOST     // agent.dev.androiduse.com
                val wsPort = BuildConfig.DEFAULT_WS_PORT     // 443

                // Save all configuration to ConfigManager
                configManager.authServerUrl = authUrl
                configManager.backendWsHost = wsHost
                configManager.backendWsPort = wsPort
                configManager.backendWsEnabled = true

                // Update RetrofitClient with new URL (also persisted internally)
                RetrofitClient.setBaseUrlAndPersist(authUrl, this)
            }
            "production" -> {
                // Use BuildConfig values from production flavor
                val authUrl = BuildConfig.DEFAULT_AUTH_URL  // https://androiduse.com
                val wsHost = BuildConfig.DEFAULT_WS_HOST     // agent.androiduse.com
                val wsPort = BuildConfig.DEFAULT_WS_PORT     // 443

                // Save all configuration to ConfigManager
                configManager.authServerUrl = authUrl
                configManager.backendWsHost = wsHost
                configManager.backendWsPort = wsPort
                configManager.backendWsEnabled = true

                // Update RetrofitClient with new URL (also persisted internally)
                RetrofitClient.setBaseUrlAndPersist(authUrl, this)
            }
        }
    }

    /**
     * Show loading indicator
     */
    private fun showLoading(show: Boolean) {
        binding.progressAuth.visibility = if (show) View.VISIBLE else View.GONE
        binding.btnEmailAuth.isEnabled = !show
        binding.btnSignInGoogle.isEnabled = !show
        binding.btnSignInGitHub.isEnabled = !show
        binding.btnSignInTwitter.isEnabled = !show
        binding.etEmail.isEnabled = !show
        binding.etPassword.isEnabled = !show
        binding.etName.isEnabled = !show
    }

    /**
     * Show status message
     */
    private fun showStatus(message: String) {
        binding.tvAuthStatus.text = message
        binding.tvAuthStatus.visibility = View.VISIBLE
    }

    /**
     * Hide status message
     */
    private fun hideStatus() {
        binding.tvAuthStatus.visibility = View.GONE
    }

    /**
     * Navigate to appropriate activity based on completion status
     * Flow: OnboardingActivity → SurveyActivity → MainActivity
     */
    private fun navigateToMainActivity() {
        // Determine destination based on completion status
        val destinationClass = when {
            !configManager.isOnboardingComplete -> OnboardingActivity::class.java
            !configManager.isSurveyComplete -> SurveyActivity::class.java
            else -> MainActivity::class.java
        }

        val intent = Intent(this, destinationClass)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}
