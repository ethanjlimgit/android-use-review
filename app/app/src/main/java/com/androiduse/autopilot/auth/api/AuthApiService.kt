package com.androiduse.autopilot.auth.api

import com.androiduse.autopilot.auth.model.AuthToken
import com.androiduse.autopilot.auth.model.User
import com.androiduse.autopilot.model.Task
import com.androiduse.autopilot.survey.model.SurveyApiResponse
import com.androiduse.autopilot.survey.model.SurveyRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface AuthApiService {
    /**
     * Exchange Google ID token for session JWT
     * POST /api/auth/mobile/google
     */
    @POST("/api/auth/mobile/google")
    suspend fun exchangeGoogleToken(
        @Body request: GoogleTokenRequest
    ): Response<AuthResponse>

    /**
     * Exchange OAuth authorization code for session JWT
     * POST /api/auth/mobile/oauth
     */
    @POST("/api/auth/mobile/oauth")
    suspend fun exchangeOAuthCode(
        @Body request: OAuthCodeRequest
    ): Response<AuthResponse>

    /**
     * Refresh access token
     * POST /api/auth/mobile/refresh
     */
    @POST("/api/auth/mobile/refresh")
    suspend fun refreshToken(
        @Body request: RefreshTokenRequest
    ): Response<AuthResponse>

    /**
     * Validate current session
     * POST /api/auth/mobile/validate
     */
    @POST("/api/auth/mobile/validate")
    suspend fun validateSession(
        @Body request: ValidateSessionRequest
    ): Response<ValidateResponse>

    /**
     * Sign up with email and password
     * POST /api/auth/signup
     */
    @POST("/api/auth/signup")
    suspend fun signUp(
        @Body request: EmailPasswordSignUpRequest
    ): Response<AuthResponse>

    /**
     * Sign in with email and password
     * POST /api/auth/mobile/signin
     */
    @POST("/api/auth/mobile/signin")
    suspend fun signIn(
        @Body request: EmailPasswordSignInRequest
    ): Response<AuthResponse>

    /**
     * Register FCM token for device
     * POST /api/devices/fcm-token
     */
    @POST("/api/devices/fcm-token")
    suspend fun registerFCMToken(
        @Body request: FCMTokenRequest
    ): Response<FCMTokenResponse>

    /**
     * Submit onboarding survey data
     * POST /api/onboarding/survey
     * Requires Authorization header (automatically added by RetrofitClient)
     */
    @POST("/api/onboarding/survey")
    suspend fun submitSurvey(
        @Body request: SurveyRequest
    ): Response<SurveyApiResponse>

    /**
     * Get current user profile
     * GET /api/user/profile
     * Requires Authorization header (automatically added by RetrofitClient)
     */
    @GET("/api/user/profile")
    suspend fun getCurrentUser(): Response<UserProfileResponse>

    /**
     * Get referral info for the authenticated user
     * GET /api/user/referral
     * Requires Authorization header (automatically added by RetrofitClient)
     */
    @GET("/api/user/referral")
    suspend fun getReferralInfo(): Response<ReferralInfoResponse>

    /**
     * Get previous tasks for the authenticated user
     * GET /api/tasks
     * Requires Authorization header (automatically added by RetrofitClient)
     *
     * Returns paginated response with cursor-based pagination
     */
    @GET("/api/tasks")
    suspend fun getTasks(
        @Query("limit") limit: Int = 10,
        @Query("cursor") cursor: String? = null
    ): Response<TasksPageResponse>

    /**
     * Archive a task (soft-delete via archivedAt timestamp)
     * PATCH /api/tasks/{taskId}
     * Requires Authorization header (automatically added by RetrofitClient)
     */
    @PATCH("/api/tasks/{taskId}")
    suspend fun archiveTask(
        @Path("taskId") taskId: String,
        @Body body: ArchiveTaskRequest
    ): Response<Task>

    /**
     * Create Stripe payment intent for subscription
     * POST /api/stripe/payment-intent
     * Requires Authorization header (automatically added by RetrofitClient)
     */
    @POST("/api/stripe/payment-intent")
    suspend fun createPaymentIntent(
        @Body request: CreatePaymentIntentRequest
    ): Response<PaymentIntentResponse>

    /**
     * Get current subscription information
     * GET /api/subscription
     * Requires Authorization header (automatically added by RetrofitClient)
     */
    @GET("/api/subscription")
    suspend fun getSubscription(): Response<SubscriptionInfo>

    /**
     * Cancel subscription at period end
     * POST /api/subscription/cancel
     * Requires Authorization header (automatically added by RetrofitClient)
     */
    @POST("/api/subscription/cancel")
    suspend fun cancelSubscription(): Response<SubscriptionActionResponse>

    /**
     * Reactivate a subscription scheduled for cancellation
     * POST /api/subscription/reactivate
     * Requires Authorization header (automatically added by RetrofitClient)
     */
    @POST("/api/subscription/reactivate")
    suspend fun reactivateSubscription(): Response<SubscriptionActionResponse>

    /**
     * Resend email verification link
     * POST /api/auth/resend-verification
     */
    @POST("/api/auth/resend-verification")
    suspend fun resendVerificationEmail(
        @Body request: ResendVerificationRequest
    ): Response<MessageResponse>

    /**
     * Request password reset link
     * POST /api/auth/forgot-password
     */
    @POST("/api/auth/forgot-password")
    suspend fun forgotPassword(
        @Body request: ForgotPasswordRequest
    ): Response<MessageResponse>
}

data class GoogleTokenRequest(
    val idToken: String,
    val serverClientId: String? = null,
    val deviceInfo: DeviceInfo,
    val referralCode: String? = null
)

data class OAuthCodeRequest(
    val code: String,
    val provider: String, // "github" or "twitter"
    val redirectUri: String,
    val codeVerifier: String? = null
)

data class RefreshTokenRequest(
    val refreshToken: String
)

data class ValidateSessionRequest(
    val accessToken: String
)

data class EmailPasswordSignUpRequest(
    val email: String,
    val password: String,
    val name: String? = null,
    val referralCode: String? = null
)

data class EmailPasswordSignInRequest(
    val email: String,
    val password: String,
    val deviceInfo: DeviceInfo
)

data class AuthResponse(
    val success: Boolean,
    val token: AuthToken? = null,
    val user: User? = null,
    val device: AuthDevice? = null,
    val error: String? = null,
    // Sign up response fields
    val message: String? = null,
    val userId: String? = null,
    val emailSent: Boolean? = null
)

data class AuthDevice(
    val id: String,           // Database UUID
    val deviceId: String,     // Client device UUID
    val name: String? = null
)

data class ValidateResponse(
    val success: Boolean,
    val user: User? = null,
    val error: String? = null
)

data class DeviceInfo(
    val deviceId: String,
    val name: String,
    val manufacturer: String,
    val model: String,
    val osVersion: String,
    val apiLevel: Int? = null,
    val displayMetrics: DisplayMetrics
)

data class DisplayMetrics(
    val widthPixels: Int,
    val heightPixels: Int,
    val densityDpi: Int,
    val density: Float,
    val refreshRate: Int? = null
)

data class FCMTokenRequest(
    val fcmToken: String,
    val deviceId: String
)

data class FCMTokenResponse(
    val success: Boolean,
    val message: String? = null,
    val device: FCMTokenDevice? = null,
    val error: String? = null
)

data class FCMTokenDevice(
    val id: String,
    val userId: String,
    val name: String,
    val deviceId: String,
    val deviceTypeId: String,
    val osVersion: String,
    val status: String,
    val lastActive: String,
    val createdAt: String,
    val fcmToken: String
)

// Subscription-related data models

data class CreatePaymentIntentRequest(
    val tier: String,              // "basic", "premium", or "business"
    val billingPeriod: String,     // "monthly" or "yearly"
    val hasTrial: Boolean = false  // true = SetupIntent (trial), false = PaymentIntent (immediate)
)

data class PaymentIntentResponse(
    val success: Boolean,
    val clientSecret: String? = null,       // Required for Payment Sheet
    val customer: String? = null,           // Stripe customer ID
    val subscriptionId: String? = null,     // Stripe subscription ID
    val publishableKey: String? = null,     // Stripe publishable key from backend
    val error: String? = null
)

data class SubscriptionInfo(
    val tier: String,                    // "free", "basic", "premium", "business"
    val status: String,                  // "inactive", "active", "canceled", "past_due", "trialing"
    val creditAllowance: Int,
    val creditsUsed: Int,
    val freeBonusCredits: Int = 0,       // Bonus credits from referrals, etc.
    val totalAvailableCredits: Int = 0,  // Total available (bonus + remaining allowance)
    val creditResetDate: String? = null,  // ISO date string
    val currentPeriodEnd: String? = null, // ISO date string
    val cancelAtPeriodEnd: Boolean? = null,
    val hasStripeCustomer: Boolean
)

data class SubscriptionActionResponse(
    val success: Boolean,
    val subscription: SubscriptionInfo? = null,
    val error: String? = null
)

// Response from /api/user/profile endpoint
data class UserProfileResponse(
    val id: String,
    val name: String?,
    val email: String?,
    val image: String?,
    val surveyCompleted: Boolean?
)

// Request for resending verification email
data class ResendVerificationRequest(
    val email: String
)

// Request for password reset
data class ForgotPasswordRequest(
    val email: String
)

// Generic message response
data class MessageResponse(
    val message: String,
    val error: String? = null
)

// Referral info response
data class ReferralInfoResponse(
    val success: Boolean,
    val referralCode: String,
    val referralCount: Int,
    val totalCreditsEarned: Int,
    val maxReferrals: Int,
    val remainingReferrals: Int,
    val referrals: List<ReferralEntry>
)

data class ReferralEntry(
    val id: String,
    val refereeEmail: String?,
    val refereeName: String?,
    val status: String, // "PENDING", "COMPLETED", "EXPIRED"
    val bonusCredits: Int,
    val createdAt: String,
    val completedAt: String?
)

data class ArchiveTaskRequest(
    val archivedAt: String
)

data class TasksPageResponse(
    val tasks: List<Task>,
    val nextCursor: String?
)
