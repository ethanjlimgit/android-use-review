package com.androiduse.autopilot.paywall

import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.RadioButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.androiduse.autopilot.analytics.AnalyticsManager
import com.androiduse.autopilot.R
import com.androiduse.autopilot.auth.api.RetrofitClient
import com.androiduse.autopilot.auth.api.CreatePaymentIntentRequest
import com.google.android.material.card.MaterialCardView
import com.stripe.android.PaymentConfiguration
import com.stripe.android.paymentsheet.PaymentSheet
import com.stripe.android.paymentsheet.PaymentSheetResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Stripe Payment Activity
 *
 * Handles subscription checkout using Stripe Payment Sheet:
 * 1. User selects plan (yearly/monthly)
 * 2. Creates checkout session via backend API
 * 3. Launches Stripe Payment Sheet for card input
 * 4. Handles payment confirmation
 * 5. Syncs subscription status after success
 *
 * For trial subscriptions:
 * - Payment method is collected but not charged immediately
 * - Backend sets up trial period based on plan
 * - User gains immediate access during trial
 */
class StripePaymentActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "StripePaymentActivity"
        const val EXTRA_SELECTED_PLAN = "selected_plan"
        const val EXTRA_BILLING_PERIOD = "billing_period"
        const val RESULT_PAYMENT_SUCCESS = RESULT_OK
        const val RESULT_PAYMENT_FAILED = RESULT_CANCELED

        // Plan constants
        const val PLAN_BASIC = "basic"
        const val PLAN_PREMIUM = "premium"
        const val PLAN_BUSINESS = "business"

        // Billing period constants
        const val BILLING_YEARLY = "yearly"
        const val BILLING_MONTHLY = "monthly"
    }

    private lateinit var paymentSheet: PaymentSheet
    private lateinit var taskLimitManager: TaskLimitManager

    // UI components
    private lateinit var progressBar: ProgressBar
    private lateinit var rbMonthly: RadioButton
    private lateinit var rbYearly: RadioButton
    private lateinit var cardYearly: MaterialCardView
    private lateinit var cardMonthly: MaterialCardView
    private lateinit var btnSubscribe: Button
    private lateinit var tvPlanName: TextView
    private lateinit var tvTaskCount: TextView
    private lateinit var tvMonthlyPrice: TextView
    private lateinit var tvYearlyPrice: TextView
    private lateinit var tvYearlySavings: TextView

    private var selectedTier: String = PLAN_BASIC
    private var selectedBillingPeriod: String = BILLING_YEARLY

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_stripe_payment)

        // Initialize Stripe Payment Sheet - suppress deprecation as this is still the recommended approach
        @Suppress("DEPRECATION")
        paymentSheet = PaymentSheet(this, ::onPaymentSheetResult)
        taskLimitManager = TaskLimitManager.getInstance(this)

        // Get selected plan from intent (default to basic)
        selectedTier = intent.getStringExtra(EXTRA_SELECTED_PLAN) ?: PLAN_BASIC
        selectedBillingPeriod = intent.getStringExtra(EXTRA_BILLING_PERIOD) ?: BILLING_YEARLY

        initViews()
        setupListeners()
        updateCardVisualStates()  // Set initial visual state
        updateTaskCountDisplay()
        updateUI()

        // Track paywall opened event
        AnalyticsManager.capture(
            event = "paywall_opened",
            properties = mapOf(
                "selected_plan" to selectedTier,
                "billing_period" to selectedBillingPeriod,
                "credits_used" to taskLimitManager.creditsUsed,
                "credit_allowance" to taskLimitManager.creditAllowance
            )
        )
    }

    private fun initViews() {
        progressBar = findViewById(R.id.progressBar)
        rbMonthly = findViewById(R.id.rbMonthly)
        rbYearly = findViewById(R.id.rbYearly)
        cardYearly = findViewById(R.id.cardYearly)
        cardMonthly = findViewById(R.id.cardMonthly)
        btnSubscribe = findViewById(R.id.btnSubscribe)
        tvPlanName = findViewById(R.id.tvPlanName)
        tvTaskCount = findViewById(R.id.tvTaskCount)
        tvMonthlyPrice = findViewById(R.id.tvMonthlyPrice)
        tvYearlyPrice = findViewById(R.id.tvYearlyPrice)
        tvYearlySavings = findViewById(R.id.tvYearlySavings)

        // Set initial billing period selection
        if (selectedBillingPeriod == BILLING_YEARLY) {
            rbYearly.isChecked = true
            rbMonthly.isChecked = false
        } else {
            rbMonthly.isChecked = true
            rbYearly.isChecked = false
        }
    }

    private fun setupListeners() {
        // Card click listeners - make entire card clickable
        // When card is clicked, check that radio button and uncheck the other
        cardYearly.setOnClickListener {
            selectYearlyPlan()
        }

        cardMonthly.setOnClickListener {
            selectMonthlyPlan()
        }

        // Manual single-selection logic for radio buttons
        rbYearly.setOnClickListener {
            selectYearlyPlan()
        }

        rbMonthly.setOnClickListener {
            selectMonthlyPlan()
        }

        // Subscribe button
        btnSubscribe.setOnClickListener {
            startCheckout()
        }

        // Back button - cancel payment
        findViewById<View>(R.id.btnBack)?.setOnClickListener {
            setResult(RESULT_PAYMENT_FAILED)
            finish()
        }
    }

    /**
     * Select yearly plan and ensure only one radio button is checked
     */
    private fun selectYearlyPlan() {
        if (!rbYearly.isChecked) {
            rbYearly.isChecked = true
            rbMonthly.isChecked = false
            selectedBillingPeriod = BILLING_YEARLY
            updateCardVisualStates()
            updateUI()
        }
    }

    /**
     * Select monthly plan and ensure only one radio button is checked
     */
    private fun selectMonthlyPlan() {
        if (!rbMonthly.isChecked) {
            rbMonthly.isChecked = true
            rbYearly.isChecked = false
            selectedBillingPeriod = BILLING_MONTHLY
            updateCardVisualStates()
            updateUI()
        }
    }

    /**
     * Update visual states of billing period cards based on selection
     * Only updates card borders - RadioGroup handles radio button states
     */
    private fun updateCardVisualStates() {
        val isYearlySelected = selectedBillingPeriod == BILLING_YEARLY

        // Update yearly card appearance - only highlight if selected
        if (isYearlySelected) {
            cardYearly.strokeWidth = 8
            cardYearly.strokeColor = getColor(R.color.androiduse_primary)
        } else {
            cardYearly.strokeWidth = 1
            cardYearly.strokeColor = getColor(R.color.androiduse_border)
        }

        // Update monthly card appearance - only highlight if selected
        if (isYearlySelected) {
            cardMonthly.strokeWidth = 1
            cardMonthly.strokeColor = getColor(R.color.androiduse_border)
        } else {
            cardMonthly.strokeWidth = 8
            cardMonthly.strokeColor = getColor(R.color.androiduse_primary)
        }
    }

    /**
     * Update credit usage display - only shown if user has used significant credits
     */
    private fun updateTaskCountDisplay() {
        val creditsUsed = taskLimitManager.creditsUsed
        val creditAllowance = taskLimitManager.creditAllowance
        val hasReachedLimit = taskLimitManager.hasReachedLimit()

        if (hasReachedLimit || creditsUsed > 0) {
            tvTaskCount.text = "You've used $creditsUsed/$creditAllowance free credits"
            tvTaskCount.visibility = View.VISIBLE
        } else {
            tvTaskCount.visibility = View.GONE
        }
    }

    private fun updateUI() {
        // Update plan name
        tvPlanName.text = when (selectedTier) {
            PLAN_BASIC -> "Upgrade Plan"
            PLAN_PREMIUM -> "Premium Plan"
            PLAN_BUSINESS -> "Business Plan"
            else -> "Upgrade Plan"
        }

        // Update pricing based on tier
        when (selectedTier) {
            PLAN_BASIC -> {
                tvMonthlyPrice.text = "$12.99/month"
                tvYearlyPrice.text = "$79.99/year"
                tvYearlySavings.text = "Save $75.89/year"
            }
            PLAN_PREMIUM -> {
                tvMonthlyPrice.text = "$49/month"
                tvYearlyPrice.text = "$470/year"
                tvYearlySavings.text = "Save $118/year"
            }
            PLAN_BUSINESS -> {
                tvMonthlyPrice.text = "$199/month"
                tvYearlyPrice.text = "$1910/year"
                tvYearlySavings.text = "Save $478/year"
            }
        }

        // Update button text based on billing period
        btnSubscribe.text = if (selectedBillingPeriod == BILLING_YEARLY) {
            "Start 5-Day Free Trial"
        } else {
            "Subscribe Now"
        }
    }

    /**
     * Check if the selected plan has a trial period
     * Basic yearly plan has 5-day trial, others don't
     */
    private fun hasTrial(): Boolean {
        return selectedTier == PLAN_BASIC && selectedBillingPeriod == BILLING_YEARLY
    }

    private fun startCheckout() {
        showLoading(true)

        val hasTrial = hasTrial()
        Log.d(TAG, "Starting checkout - hasTrial: $hasTrial, tier: $selectedTier, period: $selectedBillingPeriod")

        lifecycleScope.launch {
            try {
                // Step 1: Create payment intent via backend API
                val intentResponse = withContext(Dispatchers.IO) {
                    RetrofitClient.api.createPaymentIntent(
                        request = CreatePaymentIntentRequest(
                            tier = selectedTier,
                            billingPeriod = selectedBillingPeriod
                        )
                    )
                }

                if (!intentResponse.isSuccessful || intentResponse.body()?.success != true) {
                    val error = intentResponse.body()?.error ?: "Failed to create payment intent"
                    Log.e(TAG, "Payment intent creation failed: $error")
                    showError("Failed to initialize payment: $error")
                    return@launch
                }

                val responseBody = intentResponse.body()!!

                // Step 2: Get client secret from response
                val clientSecret = responseBody.clientSecret
                if (clientSecret == null) {
                    Log.e(TAG, "No client secret in response")
                    showError("Invalid payment session")
                    return@launch
                }

                Log.d(TAG, "Client secret obtained: ${clientSecret.take(20)}...")

                // Step 3: Get publishable key from backend response
                val publishableKey = responseBody.publishableKey
                if (publishableKey == null) {
                    Log.e(TAG, "No publishable key in response")
                    showError("Invalid payment configuration")
                    return@launch
                }

                Log.d(TAG, "Using publishable key from backend: ${publishableKey.take(10)}...")
                val isTestMode = publishableKey.startsWith("pk_test_")

                // Initialize Stripe with backend-provided key
                PaymentConfiguration.init(
                    context = applicationContext,
                    publishableKey = publishableKey
                )

                // Step 4: Configure Payment Sheet
                val configuration = PaymentSheet.Configuration(
                    merchantDisplayName = "PhoneGPT",
                    customer = null, // Backend handltaskes customer creation
                    googlePay = PaymentSheet.GooglePayConfiguration(
                        environment = if (isTestMode) {
                            PaymentSheet.GooglePayConfiguration.Environment.Test
                        } else {
                            PaymentSheet.GooglePayConfiguration.Environment.Production
                        },
                        countryCode = "US",
                        currencyCode = "USD"
                    )
                )

                // Step 5: Launch Stripe Payment Sheet
                // Use SetupIntent for trials (saves payment method without charging)
                // Use PaymentIntent for immediate payment (no trial)
                Log.d(TAG, "Customer ID: ${responseBody.customer}")
                Log.d(TAG, "Subscription ID: ${responseBody.subscriptionId}")

                if (hasTrial) {
                    Log.d(TAG, "Launching Payment Sheet with SetupIntent (trial subscription)...")
                    paymentSheet.presentWithSetupIntent(clientSecret, configuration)
                } else {
                    Log.d(TAG, "Launching Payment Sheet with PaymentIntent (immediate payment)...")
                    paymentSheet.presentWithPaymentIntent(clientSecret, configuration)
                }

                // Loading will be hidden when payment result is received

            } catch (e: Exception) {
                Log.e(TAG, "Error creating payment intent", e)
                showError("Payment failed: ${e.message}")
                showLoading(false)
            }
            // Note: Don't hide loading here if Payment Sheet launched successfully
            // Loading will be hidden in onPaymentSheetResult callback
        }
    }

    private fun onPaymentSheetResult(paymentResult: PaymentSheetResult) {
        when (paymentResult) {
            is PaymentSheetResult.Completed -> {
                Log.i(TAG, "Payment completed successfully")
                Toast.makeText(this, "Payment successful!", Toast.LENGTH_SHORT).show()

                // Track payment success
                AnalyticsManager.capture(
                    event = "payment_completed",
                    properties = mapOf(
                        "plan" to selectedTier,
                        "billing_period" to selectedBillingPeriod
                    )
                )

                // Sync subscription status from server
                // Loading will be handled by syncSubscriptionAndFinish()
                syncSubscriptionAndFinish()
            }
            is PaymentSheetResult.Canceled -> {
                Log.d(TAG, "Payment canceled by user")
                showLoading(false)
                Toast.makeText(this, "Payment canceled", Toast.LENGTH_SHORT).show()

                // Track payment cancellation
                AnalyticsManager.capture(
                    event = "payment_canceled",
                    properties = mapOf(
                        "plan" to selectedTier,
                        "billing_period" to selectedBillingPeriod
                    )
                )
            }
            is PaymentSheetResult.Failed -> {
                Log.e(TAG, "Payment failed: ${paymentResult.error.message}")
                showError("Payment failed: ${paymentResult.error.localizedMessage}")

                // Track payment failure
                AnalyticsManager.capture(
                    event = "payment_failed",
                    properties = mapOf(
                        "plan" to selectedTier,
                        "billing_period" to selectedBillingPeriod,
                        "error" to (paymentResult.error.message ?: "unknown")
                    )
                )
            }
        }
    }

    private fun syncSubscriptionAndFinish() {
        showLoading(true)

        lifecycleScope.launch {
            try {
                // Clear subscription cache to force refresh
                val subscriptionManager = SubscriptionManager.getInstance(this@StripePaymentActivity)
                subscriptionManager.clearCache()

                // Sync from server
                val success = subscriptionManager.syncFromServer()

                if (success) {
                    Log.i(TAG, "Subscription synced successfully")
                    setResult(RESULT_PAYMENT_SUCCESS)
                    finish()
                } else {
                    Log.w(TAG, "Subscription sync failed, but payment succeeded")
                    // Still return success - sync will happen later
                    setResult(RESULT_PAYMENT_SUCCESS)
                    finish()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error syncing subscription", e)
                // Still return success - sync will happen later
                setResult(RESULT_PAYMENT_SUCCESS)
                finish()
            }
        }
    }

    private fun showLoading(loading: Boolean) {
        progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        btnSubscribe.isEnabled = !loading
        // Disable/enable radio buttons and cards
        rbYearly.isEnabled = !loading
        rbMonthly.isEnabled = !loading
        cardYearly.isEnabled = !loading
        cardMonthly.isEnabled = !loading
    }

    private fun showError(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        showLoading(false)
    }
}
