package com.androiduse.autopilot.survey

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import com.androiduse.autopilot.analytics.AnalyticsManager
import com.androiduse.autopilot.survey.model.SurveyRequest
import com.androiduse.autopilot.survey.model.SurveyResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * ViewModel for survey flow
 * Manages state for survey responses and navigation between survey screens
 */
class SurveyViewModel : ViewModel() {

    private lateinit var repository: SurveyRepository

    private val _state = MutableStateFlow(SurveyState())
    val state: StateFlow<SurveyState> = _state.asStateFlow()

    /**
     * Personal email domains that skip company-related questions
     */
    private val personalDomains = setOf(
        "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
        "live.com", "icloud.com", "me.com", "aol.com",
        "protonmail.com", "mail.com", "zoho.com", "yandex.com"
    )

    /**
     * Initialize ViewModel with context
     */
    fun init(context: Context) {
        repository = SurveyRepository(context.applicationContext)
    }

    /**
     * Determine the starting screen based on email domain
     * Personal domains and guests start at USER_TYPE, company domains skip to COMPANY_SIZE
     * Updates the state to reflect the initial step
     *
     * @param email User's email (nullable for guest users)
     */
    fun determineStartScreen(email: String?) {
        Log.d("SurveyViewModel", "determineStartScreen called with email: $email")

        // Guest users (no email) or empty/blank emails are treated as personal users
        // They start at USER_TYPE to choose Individual or Company
        val startStep = if (email.isNullOrBlank()) {
            Log.d("SurveyViewModel", "Guest user detected (null/blank email) - starting at USER_TYPE")
            SurveyStep.USER_TYPE
        } else {
            val domain = email.substringAfter("@", "").lowercase().trim()
            if (domain.isEmpty() || domain in personalDomains) {
                Log.d("SurveyViewModel", "Personal email domain detected: $domain - starting at USER_TYPE")
                SurveyStep.USER_TYPE
            } else {
                Log.d("SurveyViewModel", "Company email domain detected: $domain - starting at COMPANY_SIZE")
                SurveyStep.COMPANY_SIZE
            }
        }

        // Update state with initial step and company flag
        // Guest users always default to isCompany = false (Individual)
        val isCompanyValue = if (email.isNullOrBlank()) false else startStep == SurveyStep.COMPANY_SIZE
        Log.d("SurveyViewModel", "Initial state - startStep: $startStep, isCompany: $isCompanyValue")

        _state.value = _state.value.copy(
            currentStep = startStep,
            initialStep = startStep,
            isCompany = isCompanyValue
        )

        // Track survey started event
        AnalyticsManager.capture(
            event = "survey_started",
            properties = mapOf(
                "start_step" to startStep.name,
                "is_company" to isCompanyValue,
                "email_domain" to (email?.substringAfter("@", "") ?: "guest")
            )
        )
    }

    /**
     * Set user type (individual or company)
     */
    fun setUserType(isCompany: Boolean) {
        Log.d("SurveyViewModel", "setUserType: $isCompany")
        _state.value = _state.value.copy(isCompany = isCompany)
    }

    /**
     * Set company size
     */
    fun setCompanySize(size: String) {
        Log.d("SurveyViewModel", "setCompanySize: $size")
        _state.value = _state.value.copy(companySize = size)
    }

    /**
     * Set industry
     */
    fun setIndustry(industry: String) {
        Log.d("SurveyViewModel", "setIndustry: $industry")
        _state.value = _state.value.copy(industry = industry)
    }

    /**
     * Set role
     */
    fun setRole(role: String, customRole: String? = null) {
        Log.d("SurveyViewModel", "setRole: $role, customRole: $customRole")
        _state.value = _state.value.copy(role = role, customRole = customRole)
    }

    /**
     * Set use case
     */
    fun setUseCase(useCase: String) {
        Log.d("SurveyViewModel", "setUseCase: $useCase")
        _state.value = _state.value.copy(useCase = useCase)
    }

    /**
     * Navigate to the next step in the survey flow
     */
    fun navigateNext() {
        val currentStep = _state.value.currentStep
        val currentState = _state.value

        Log.d("SurveyViewModel", "navigateNext called - currentStep: $currentStep, state: $currentState")

        val nextStep = when (currentStep) {
            SurveyStep.USER_TYPE -> {
                // Individual goes to INDUSTRY, Company goes to COMPANY_SIZE
                if (currentState.isCompany) {
                    SurveyStep.COMPANY_SIZE
                } else {
                    SurveyStep.INDUSTRY
                }
            }

            SurveyStep.COMPANY_SIZE -> SurveyStep.INDUSTRY

            SurveyStep.INDUSTRY -> {
                // Validate industry is set before navigating
                if (_state.value.industry.isNullOrBlank()) {
                    Log.w("SurveyViewModel", "Industry not set, using default 'Other'")
                    _state.value = _state.value.copy(industry = "Other")
                }
                SurveyStep.ROLE
            }

            SurveyStep.ROLE -> SurveyStep.USE_CASE

            SurveyStep.USE_CASE -> SurveyStep.PERSONALIZING

            SurveyStep.PERSONALIZING -> return // Already at the end
        }

        Log.d("SurveyViewModel", "Navigating to nextStep: $nextStep")
        _state.value = _state.value.copy(currentStep = nextStep)
    }

    /**
     * Navigate to the previous step in the survey flow
     */
    fun navigateBack(): Boolean {
        val currentStep = _state.value.currentStep
        val currentState = _state.value

        // Can't go back from the initial screen
        if (currentStep == currentState.initialStep) {
            return false
        }

        val previousStep = when (currentStep) {
            SurveyStep.USER_TYPE -> return false // Shouldn't reach here due to check above

            SurveyStep.COMPANY_SIZE -> {
                // Only reachable if we came from USER_TYPE (user selected "Company")
                SurveyStep.USER_TYPE
            }

            SurveyStep.INDUSTRY -> {
                // If company, go back to COMPANY_SIZE
                // If individual, go back to USER_TYPE
                if (currentState.isCompany && currentState.companySize != null) {
                    SurveyStep.COMPANY_SIZE
                } else {
                    SurveyStep.USER_TYPE
                }
            }

            SurveyStep.ROLE -> SurveyStep.INDUSTRY

            SurveyStep.USE_CASE -> SurveyStep.ROLE

            SurveyStep.PERSONALIZING -> SurveyStep.USE_CASE
        }

        _state.value = _state.value.copy(currentStep = previousStep)
        return true
    }

    /**
     * Save survey response to repository
     * Handles guest users by using fallback values for null userId/email
     *
     * @param userId User ID (nullable for guest users)
     * @param email User email (nullable for guest users)
     */
    fun saveSurvey(userId: String?, email: String?) {
        // For guest users (null userId/email), use safe defaults
        val safeUserId = if (userId.isNullOrBlank()) "guest_id" else userId
        val safeEmail = if (email.isNullOrBlank()) "guest@androiduse.local" else email

        // Guest users default to Individual (isCompany = false)
        val isCompanyValue = if (userId.isNullOrBlank() && email.isNullOrBlank()) {
            false
        } else {
            _state.value.isCompany
        }

        val response = SurveyResponse(
            userId = safeUserId,
            email = safeEmail,
            isCompany = isCompanyValue,
            companySize = _state.value.companySize,
            industry = _state.value.industry,
            role = _state.value.role,
            customRole = _state.value.customRole,
            useCase = _state.value.useCase
        )
        repository.saveSurveyResponse(response)
    }

    /**
     * Submit survey data to backend API
     * Always saves locally first, then attempts API submission
     * API failure does NOT block user progression
     *
     * @param userId User ID from SessionManager (nullable for guests)
     * @param email User email from SessionManager (nullable for guests)
     * @param scope CoroutineScope for launching coroutine
     * @param onComplete Callback invoked when process completes (success or failure)
     */
    fun submitSurveyToBackend(
        userId: String?,
        email: String?,
        scope: CoroutineScope,
        onComplete: (success: Boolean) -> Unit
    ) {
        scope.launch {
            // Step 1: ALWAYS save locally first (ensures data isn't lost)
            saveSurvey(userId, email)
            Log.d("SurveyViewModel", "Survey saved locally")

            // Step 2: Skip API submission for guest users (no auth token)
            if (userId.isNullOrBlank()) {
                Log.d("SurveyViewModel", "Guest user - skipping API submission")
                withContext(Dispatchers.Main) {
                    onComplete(false)
                }
                return@launch
            }

            // Step 3: Validate required fields before API submission
            val currentState = _state.value

            // Validate use case length (backend requires 10-500 chars)
            val useCase = currentState.useCase
            if (useCase.isNullOrBlank() || useCase.length < 10) {
                Log.w("SurveyViewModel", "Use case too short (${useCase?.length ?: 0} chars), skipping API submission")
                withContext(Dispatchers.Main) {
                    onComplete(false)
                }
                return@launch
            }

            if (useCase.length > 500) {
                Log.w("SurveyViewModel", "Use case too long (${useCase.length} chars), truncating")
            }

            // Step 4: Build API request with normalized data
            val normalizedIndustry = IndustryMapper.normalizeIndustry(currentState.industry)
            val normalizedCompanySize = CompanySizeMapper.normalizeCompanySize(currentState.companySize)

            // Determine user type
            val userType = if (currentState.isCompany) "company" else "individual"

            // Use role as occupation, or customRole if "Other" was selected
            val occupation = currentState.customRole?.takeIf { it.isNotBlank() }
                ?: currentState.role
                ?: "User"  // Fallback if no role specified

            val apiRequest = SurveyRequest(
                userType = userType,
                companySize = normalizedCompanySize,
                industry = normalizedIndustry,
                occupation = occupation,
                useCase = useCase.take(500)  // Ensure max 500 chars
            )

            Log.d("SurveyViewModel", "Submitting survey to API: $apiRequest")

            // Step 5: Submit to API (non-blocking)
            val result = repository.submitSurveyToApi(apiRequest)

            val success = result != null && result.success

            if (success) {
                Log.d("SurveyViewModel", "Survey successfully synced to backend")

                // Track survey completion event
                AnalyticsManager.capture(
                    event = "survey_completed",
                    properties = mapOf(
                        "user_type" to userType,
                        "company_size" to (normalizedCompanySize ?: "none"),
                        "industry" to (normalizedIndustry ?: "none"),
                        "occupation" to occupation,
                        "use_case_length" to useCase.length
                    )
                )
            } else {
                Log.w("SurveyViewModel", "Survey API submission failed, but local data is saved")
            }

            // Step 6: Invoke callback on main thread
            withContext(Dispatchers.Main) {
                onComplete(success)
            }
        }
    }
}

/**
 * State for the survey flow
 */
data class SurveyState(
    val currentStep: SurveyStep = SurveyStep.USER_TYPE,
    val initialStep: SurveyStep = SurveyStep.USER_TYPE,
    val isCompany: Boolean = false,
    val companySize: String? = null,
    val industry: String? = null,
    val role: String? = null,
    val customRole: String? = null,
    val useCase: String? = null
)

/**
 * Steps in the survey flow
 */
enum class SurveyStep {
    USER_TYPE,
    COMPANY_SIZE,
    INDUSTRY,
    ROLE,
    USE_CASE,
    PERSONALIZING
}
