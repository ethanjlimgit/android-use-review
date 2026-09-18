package com.androiduse.autopilot.profile

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.androiduse.autopilot.auth.SessionManager
import com.androiduse.autopilot.auth.api.ReferralInfoResponse
import com.androiduse.autopilot.auth.api.RetrofitClient
import com.androiduse.autopilot.auth.api.SubscriptionInfo
import com.androiduse.autopilot.auth.model.AuthProvider
import com.androiduse.autopilot.auth.model.User
import com.androiduse.autopilot.auth.ui.AuthActivity
import com.androiduse.autopilot.cache.CacheManager
import com.androiduse.autopilot.config.ConfigManager
import com.androiduse.autopilot.paywall.StripePaymentActivity
import com.androiduse.autopilot.paywall.SubscriptionManager
import com.androiduse.autopilot.BuildConfig
import com.androiduse.autopilot.R
import com.androiduse.autopilot.databinding.ActivityProfileBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Profile Activity
 *
 * Displays:
 * - User account information (name, email, avatar)
 * - Current subscription tier and status
 * - Credit usage for paid tiers
 * - Task limit for free tier
 * - Manage subscription button
 * - Sign out functionality
 */
class ProfileActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "ProfileActivity"
    }

    private lateinit var binding: ActivityProfileBinding
    private lateinit var subscriptionManager: SubscriptionManager
    private lateinit var cacheManager: CacheManager
    private lateinit var configManager: ConfigManager
    private lateinit var sessionManager: SessionManager

    private var currentUser: User? = null
    private var referralInfo: ReferralInfoResponse? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityProfileBinding.inflate(layoutInflater)
        setContentView(binding.root)

        subscriptionManager = SubscriptionManager.Companion.getInstance(this)
        cacheManager = CacheManager.getInstance(this)
        configManager = ConfigManager.Companion.getInstance(this)
        sessionManager = SessionManager(this)

        setupToolbar()
        setupListeners()
        setupReferralListeners()
        loadUserData()
    }

    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)

        // Handle back button click
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }

    private fun setupListeners() {

        // Manage Subscription button
        binding.btnManageSubscription.setOnClickListener {
            manageSubscription()
        }

        // Sign Out button
        binding.btnSignOut.setOnClickListener {
            showSignOutConfirmation()
        }
    }

    private fun setupReferralListeners() {
        // Copy referral code button
        binding.btnCopyReferralCode.setOnClickListener {
            copyReferralCodeToClipboard()
        }

        // Share referral button
        binding.btnShareReferral.setOnClickListener {
            shareReferralLink()
        }
    }

    private fun copyReferralCodeToClipboard() {
        val code = referralInfo?.referralCode ?: return

        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("Referral Code", code)
        clipboard.setPrimaryClip(clip)

        Toast.makeText(this, "Referral code copied!", Toast.LENGTH_SHORT).show()
    }

    private fun shareReferralLink() {
        val code = referralInfo?.referralCode ?: return
        val baseUrl = when (BuildConfig.DEFAULT_ENVIRONMENT) {
            "production" -> "https://androiduse.com"
            "staging" -> "https://dev.androiduse.com"
            else -> "https://dev.androiduse.com"
        }
        val referralLink = "$baseUrl/ref/$code"

        val shareIntent = Intent().apply {
            action = Intent.ACTION_SEND
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "Join PhoneGPT")
            putExtra(Intent.EXTRA_TEXT, "Check out PhoneGPT - Your phone autopilot! Use my referral link to sign up: $referralLink")
        }
        startActivity(Intent.createChooser(shareIntent, "Share via"))
    }

    private fun loadUserData() {
        // Display cached profile immediately if available
        val cachedProfile = cacheManager.profileCache.getCachedProfile()
        if (cachedProfile != null) {
            Log.d(TAG, "Displaying cached profile for: ${cachedProfile.email}")
            currentUser = User(
                id = cachedProfile.id,
                email = cachedProfile.email ?: "No email",
                name = cachedProfile.name,
                picture = cachedProfile.image,
                provider = AuthProvider.UNKNOWN
            )
            displayUserInfo(currentUser)
            displaySubscriptionInfo()
        } else {
            showLoading(true)
        }

        // Fetch fresh data from server
        lifecycleScope.launch {
            try {
                val userResult = withContext(Dispatchers.IO) {
                    RetrofitClient.api.getCurrentUser()
                }

                val referralResult = withContext(Dispatchers.IO) {
                    try {
                        RetrofitClient.api.getReferralInfo()
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to load referral info: ${e.message}")
                        null
                    }
                }

                // Sync subscription from server
                subscriptionManager.syncFromServer()

                if (userResult.isSuccessful && userResult.body() != null) {
                    val profile = userResult.body()!!
                    // Cache the fresh profile
                    cacheManager.profileCache.cacheProfile(profile)
                    // Convert UserProfileResponse to User model
                    currentUser = User(
                        id = profile.id,
                        email = profile.email ?: "No email",
                        name = profile.name,
                        picture = profile.image,
                        provider = AuthProvider.UNKNOWN
                    )
                    displayUserInfo(currentUser)
                } else {
                    Log.w(TAG, "Failed to load user: ${userResult.code()} ${userResult.message()}")
                    if (cachedProfile == null) {
                        displayStoredUserInfo()
                    }
                }

                // Display subscription info
                displaySubscriptionInfo()

                // Display referral info
                if (referralResult?.isSuccessful == true && referralResult.body() != null) {
                    referralInfo = referralResult.body()
                    displayReferralInfo()
                } else {
                    // Hide referral card if we couldn't load data
                    binding.cardReferral.visibility = View.GONE
                }

                showLoading(false)
            } catch (e: Exception) {
                Log.e(TAG, "Error loading user data", e)
                if (cachedProfile == null) {
                    Toast.makeText(this@ProfileActivity, "Failed to load profile", Toast.LENGTH_SHORT).show()
                    displayStoredUserInfo()
                }
                displaySubscriptionInfo()
                binding.cardReferral.visibility = View.GONE
                showLoading(false)
            }
        }
    }

    private fun displayReferralInfo() {
        val info = referralInfo ?: return

        binding.cardReferral.visibility = View.VISIBLE
        binding.tvReferralCode.text = info.referralCode
        binding.tvReferralCount.text = "${info.referralCount} / ${info.maxReferrals}"
        binding.tvReferralCreditsEarned.text = "${info.totalCreditsEarned}"
    }

    private fun displayUserInfo(user: User?) {
        if (user == null) {
            binding.tvUserName.text = "Unknown User"
            binding.tvUserEmail.text = "No email"
            binding.tvUserId.text = "N/A"
            binding.tvAuthProvider.visibility = View.GONE
            return
        }

        // Display name
        binding.tvUserName.text = user.name ?: "User"

        // Display email
        binding.tvUserEmail.text = user.email

        // Display user ID
        binding.tvUserId.text = user.id

        // Display auth provider (if available)
        val providerText = when (user.provider.name.lowercase()) {
            "google" -> "Signed in with Google"
            "github" -> "Signed in with GitHub"
            "twitter" -> "Signed in with Twitter"
            "email" -> "Signed in with Email"
            "unknown" -> null
            else -> "Signed in"
        }

        if (providerText != null) {
            binding.tvAuthProvider.text = providerText
            binding.tvAuthProvider.visibility = View.VISIBLE
        } else {
            binding.tvAuthProvider.visibility = View.GONE
        }

        // Show default avatar (colored background)
        // TODO: Add image loading library (Glide/Coil) to load user.picture
        binding.ivUserAvatar.setBackgroundColor(getColor(R.color.androiduse_primary))
    }

    private fun displayStoredUserInfo() {
        // Fallback: Display basic info from config
        binding.tvUserName.text = "User"
        val token = sessionManager.getAccessToken() ?: ""
        binding.tvUserEmail.text = token.take(20) + "..."
        binding.tvUserId.text = "Cached"
        binding.tvAuthProvider.visibility = View.GONE
    }

    private fun displaySubscriptionInfo() {
        val subscription = subscriptionManager.getSubscriptionInfo()

        if (subscription == null) {
            // No subscription info - show as free tier
            displayFreeTierInfo()
            return
        }

        // Display tier badge
        val tierText = subscription.tier.uppercase()
        binding.tvSubscriptionTier.text = tierText

        // Color code tier badge
        val tierColor = when (subscription.tier) {
            "basic" -> Color.parseColor("#4CAF50")      // Green
            "premium" -> Color.parseColor("#FF9800")    // Orange
            "business" -> Color.parseColor("#9C27B0")   // Purple
            else -> Color.parseColor("#757575")         // Gray (free)
        }
        binding.tvSubscriptionTier.setBackgroundColor(tierColor)

        // Display status
        val statusText = subscription.status.replaceFirstChar {
            if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString()
        }
        binding.tvSubscriptionStatus.text = statusText

        // Show/hide sections based on tier
        if (subscription.tier == "free") {
            displayFreeTierInfo()
        } else {
            displayPaidTierInfo(subscription)
        }

        // Button visibility is handled in displayFreeTierInfo() and displayPaidTierInfo()
        // Always show the button - it says "Upgrade to Pro" for free users
        // and "Manage Subscription" for paid users
    }

    private fun displayFreeTierInfo() {
        // Hide paid tier subscription dates
        binding.layoutSubscriptionDates.visibility = View.GONE

        // Hide task limit section (deprecated)
        binding.layoutTaskLimit.visibility = View.GONE

        // Show credit usage for free tier
        binding.layoutCreditInfo.visibility = View.VISIBLE

        val subscription = subscriptionManager.getSubscriptionInfo()

        // Use new credit fields: totalAvailableCredits and freeBonusCredits
        // Match webapp calculation logic exactly
        val freeBonusCredits = subscription?.freeBonusCredits ?: 0
        val creditAllowance = subscription?.creditAllowance ?: 0
        val totalCredits = creditAllowance + freeBonusCredits
        val totalAvailable = subscription?.totalAvailableCredits ?: 0

        Log.d(TAG, "displayFreeTierInfo: freeBonusCredits=$freeBonusCredits, creditAllowance=$creditAllowance, " +
                "totalCredits=$totalCredits, totalAvailable=$totalAvailable")

        // Calculate usage percentage (how much has been used) - matches webapp
        val usagePercent = if (totalCredits > 0) {
            ((totalCredits - totalAvailable).toFloat() / totalCredits.toFloat()) * 100f
        } else {
            0f
        }
        val percentage = usagePercent.toInt().coerceIn(0, 100)

        // Low credit warning threshold - matches webapp (< 20% remaining = >= 80% used)
        val isNearCreditLimit = totalCredits > 0 && (totalAvailable.toFloat() / totalCredits.toFloat()) < 0.2f

        // Display: Available / Total
        binding.tvCreditUsage.text = "${formatNumber(totalAvailable)} / ${formatNumber(totalCredits)}"
        binding.tvCreditPercentage.text = "$percentage% used"
        binding.pbCreditUsage.progress = percentage

        // Color code progress bar - orange when near limit (matches webapp)
        val progressColor = if (isNearCreditLimit) R.color.androiduse_warning else R.color.androiduse_accent
        binding.pbCreditUsage.progressTintList = getColorStateList(progressColor)

        // Show bonus credits section if user has any
        if (freeBonusCredits > 0) {
            binding.layoutBonusCredits.visibility = View.VISIBLE
            binding.tvBonusCredits.text = formatNumber(freeBonusCredits)
        } else {
            binding.layoutBonusCredits.visibility = View.GONE
        }

        // Show low credit warning (matches webapp)
        if (isNearCreditLimit) {
            binding.layoutLowCreditWarning.visibility = View.VISIBLE
            binding.tvLowCreditWarning.text = "You are running low on credits. Upgrade to get more credits."
        } else {
            binding.layoutLowCreditWarning.visibility = View.GONE
        }

        // Display credit reset date (if available)
        if (!subscription?.creditResetDate.isNullOrEmpty()) {
            try {
                val date = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
                    .parse(subscription?.creditResetDate)
                val formattedDate = SimpleDateFormat("MMM d, yyyy", Locale.US).format(date ?: Date())
                binding.tvCreditResetDate.text = "Plan credits reset on $formattedDate"
            } catch (e: Exception) {
                binding.tvCreditResetDate.text = "Plan credits reset monthly"
            }
        } else {
            binding.tvCreditResetDate.text = "Plan credits reset monthly"
        }

        // Update tier badge
        binding.tvSubscriptionTier.text = "FREE"
        binding.tvSubscriptionTier.setBackgroundColor(Color.parseColor("#757575"))

        // Show upgrade button instead of manage
        binding.btnManageSubscription.text = "Upgrade to Pro"
        binding.btnManageSubscription.visibility = View.VISIBLE
    }

    private fun displayPaidTierInfo(subscription: SubscriptionInfo) {
        // Hide task limit
        binding.layoutTaskLimit.visibility = View.GONE

        // Show credit usage
        binding.layoutCreditInfo.visibility = View.VISIBLE

        // Use new credit fields: totalAvailableCredits and freeBonusCredits
        // Match webapp calculation logic exactly
        val freeBonusCredits = subscription.freeBonusCredits
        val creditAllowance = subscription.creditAllowance
        val totalCredits = creditAllowance + freeBonusCredits
        val totalAvailable = subscription.totalAvailableCredits

        Log.d(TAG, "displayPaidTierInfo: freeBonusCredits=$freeBonusCredits, creditAllowance=$creditAllowance, " +
                "totalCredits=$totalCredits, totalAvailable=$totalAvailable")

        // Calculate usage percentage (how much has been used) - matches webapp
        val usagePercent = if (totalCredits > 0) {
            ((totalCredits - totalAvailable).toFloat() / totalCredits.toFloat()) * 100f
        } else {
            0f
        }
        val percentage = usagePercent.toInt().coerceIn(0, 100)

        // Low credit warning threshold - matches webapp (< 20% remaining = >= 80% used)
        val isNearCreditLimit = totalCredits > 0 && (totalAvailable.toFloat() / totalCredits.toFloat()) < 0.2f

        // Display: Available / Total
        binding.tvCreditUsage.text = "${formatNumber(totalAvailable)} / ${formatNumber(totalCredits)}"
        binding.tvCreditPercentage.text = "$percentage% used"
        binding.pbCreditUsage.progress = percentage

        // Color code progress bar - orange when near limit (matches webapp)
        val progressColor = if (isNearCreditLimit) R.color.androiduse_warning else R.color.androiduse_accent
        binding.pbCreditUsage.progressTintList = getColorStateList(progressColor)

        // Show bonus credits section if user has any
        if (freeBonusCredits > 0) {
            binding.layoutBonusCredits.visibility = View.VISIBLE
            binding.tvBonusCredits.text = formatNumber(freeBonusCredits)
        } else {
            binding.layoutBonusCredits.visibility = View.GONE
        }

        // Show low credit warning (matches webapp)
        if (isNearCreditLimit) {
            binding.layoutLowCreditWarning.visibility = View.VISIBLE
            binding.tvLowCreditWarning.text = "You are running low on credits. Consider upgrading your plan."
        } else {
            binding.layoutLowCreditWarning.visibility = View.GONE
        }

        // Display credit reset date
        if (!subscription.creditResetDate.isNullOrEmpty()) {
            try {
                val date = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
                    .parse(subscription.creditResetDate)
                val formattedDate = SimpleDateFormat("MMM d, yyyy", Locale.US).format(date ?: Date())
                binding.tvCreditResetDate.text = "Plan credits reset on $formattedDate"
            } catch (e: Exception) {
                binding.tvCreditResetDate.text = "Plan credits reset monthly"
            }
        } else {
            binding.tvCreditResetDate.text = "Plan credits reset monthly"
        }

        // Display subscription dates if active
        if (subscription.status == "active" || subscription.status == "trialing") {
            binding.layoutSubscriptionDates.visibility = View.VISIBLE

            // Next billing date
            if (!subscription.currentPeriodEnd.isNullOrEmpty()) {
                try {
                    val date = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
                        .parse(subscription.currentPeriodEnd)
                    val formattedDate = SimpleDateFormat("MMM d, yyyy", Locale.US).format(date ?: Date())
                    binding.tvNextBilling.text = formattedDate
                } catch (e: Exception) {
                    binding.tvNextBilling.text = "N/A"
                }
            }

            // Cancel notice if scheduled for cancellation
            if (subscription.cancelAtPeriodEnd == true) {
                binding.tvCancelNotice.visibility = View.VISIBLE
                binding.tvCancelNotice.text = "⚠ Subscription will cancel on ${binding.tvNextBilling.text}"
            } else {
                binding.tvCancelNotice.visibility = View.GONE
            }
        } else {
            binding.layoutSubscriptionDates.visibility = View.GONE
        }

        // Update button text and show it
        binding.btnManageSubscription.text = "Manage Subscription"
        binding.btnManageSubscription.visibility = View.VISIBLE
    }

    private fun manageSubscription() {
        val subscription = subscriptionManager.getSubscriptionInfo()

        //if (subscription?.tier == "free" || subscription?.hasStripeCustomer == false) {
            // Navigate directly to upgrade flow
            val intent = Intent(this, StripePaymentActivity::class.java).apply {
                putExtra(StripePaymentActivity.Companion.EXTRA_SELECTED_PLAN, StripePaymentActivity.Companion.PLAN_BASIC)
                putExtra(StripePaymentActivity.Companion.EXTRA_BILLING_PERIOD, StripePaymentActivity.Companion.BILLING_YEARLY)
            }
            startActivity(intent)
        /* } else {
            // Open Stripe customer portal for paid users
            openStripePortal()
        }*/
    }

    private fun openStripePortal() {
        // TODO: Implement Stripe customer portal
        // This requires a backend endpoint to create a portal session
        Toast.makeText(this, "Opening subscription management...", Toast.LENGTH_SHORT).show()

        // For now, show dialog with cancel option
        AlertDialog.Builder(this)
            .setTitle("Manage Subscription")
            .setMessage("Here you can:\n• Update payment method\n• Change plan\n• Cancel subscription")
            .setPositiveButton("Cancel Subscription") { _, _ ->
                cancelSubscription()
            }
            .setNegativeButton("Close", null)
            .show()
    }

    private fun cancelSubscription() {
        AlertDialog.Builder(this)
            .setTitle("Cancel Subscription")
            .setMessage("Are you sure you want to cancel your subscription? You'll retain access until the end of your billing period.")
            .setPositiveButton("Yes, Cancel") { _, _ ->
                performCancelSubscription()
            }
            .setNegativeButton("Keep Subscription", null)
            .show()
    }

    private fun performCancelSubscription() {
        showLoading(true)

        lifecycleScope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.api.cancelSubscription()
                }

                if (response.isSuccessful && response.body()?.success == true) {
                    Toast.makeText(
                        this@ProfileActivity,
                        "Subscription canceled. You'll retain access until the end of your billing period.",
                        Toast.LENGTH_LONG
                    ).show()

                    // Refresh subscription info
                    subscriptionManager.clearCache()
                    subscriptionManager.syncFromServer()
                    displaySubscriptionInfo()
                } else {
                    val error = response.body()?.error ?: "Failed to cancel subscription"
                    Toast.makeText(this@ProfileActivity, error, Toast.LENGTH_LONG).show()
                }

                showLoading(false)
            } catch (e: Exception) {
                Log.e(TAG, "Error canceling subscription", e)
                Toast.makeText(this@ProfileActivity, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                showLoading(false)
            }
        }
    }

    private fun showSignOutConfirmation() {
        AlertDialog.Builder(this)
            .setTitle("Sign Out")
            .setMessage("Are you sure you want to sign out?")
            .setPositiveButton("Sign Out") { _, _ ->
                performSignOut()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun performSignOut() {
        // Clear session data (encrypted credentials)
        sessionManager.clearSession()

        // Clear device ID from ConfigManager
        configManager.deviceId = ""

        // Clear all user caches
        cacheManager.clearAll()

        Toast.makeText(this, "Signed out successfully", Toast.LENGTH_SHORT).show()

        // Navigate to auth activity
        val intent = Intent(this, AuthActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        startActivity(intent)
        finish()
    }

    private fun showLoading(loading: Boolean) {
        binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
    }

    private fun formatNumber(number: Int): String {
        return java.text.NumberFormat.getNumberInstance(Locale.getDefault()).format(number)
    }

    override fun onResume() {
        super.onResume()
        // Refresh subscription status when returning to profile
        subscriptionManager.syncInBackground()
    }
}
