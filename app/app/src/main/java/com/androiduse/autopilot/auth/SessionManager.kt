@file:Suppress("DEPRECATION")

package com.androiduse.autopilot.auth

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.androiduse.autopilot.auth.model.AuthProvider
import com.androiduse.autopilot.auth.model.AuthToken
import com.androiduse.autopilot.auth.model.User
import com.google.gson.Gson
import java.io.File
import javax.crypto.AEADBadTagException

class SessionManager(private val context: Context) {

    companion object {
        private const val TAG = "SessionManager"
        private const val PREFS_NAME = "androiduse_auth_prefs"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_TOKEN_EXPIRY = "token_expiry"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_PICTURE = "user_picture"
        private const val KEY_USER_PROVIDER = "user_provider"
        private const val KEY_USER_SURVEY_COMPLETED = "user_survey_completed"
    }

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences: SharedPreferences = createEncryptedSharedPreferences()

    private val gson = Gson()

    /**
     * Create EncryptedSharedPreferences with error recovery
     * If the existing encrypted data is corrupted (e.g., after app reinstall),
     * delete the corrupted file and create a new one
     */
    private fun createEncryptedSharedPreferences(): SharedPreferences {
        return try {
            EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            // Handle corrupted EncryptedSharedPreferences
            if (e.cause is AEADBadTagException || e is javax.crypto.AEADBadTagException) {
                Log.w(TAG, "EncryptedSharedPreferences corrupted, recreating...", e)
                deleteCorruptedPreferences()

                // Retry creating EncryptedSharedPreferences
                try {
                    EncryptedSharedPreferences.create(
                        context,
                        PREFS_NAME,
                        masterKey,
                        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                    )
                } catch (retryException: Exception) {
                    Log.e(TAG, "Failed to recreate EncryptedSharedPreferences", retryException)
                    throw retryException
                }
            } else {
                Log.e(TAG, "Unexpected error creating EncryptedSharedPreferences", e)
                throw e
            }
        }
    }

    /**
     * Delete corrupted SharedPreferences files
     */
    private fun deleteCorruptedPreferences() {
        try {
            val prefsDir = File(context.applicationInfo.dataDir, "shared_prefs")
            val prefsFile = File(prefsDir, "$PREFS_NAME.xml")

            if (prefsFile.exists()) {
                val deleted = prefsFile.delete()
                Log.d(TAG, "Deleted corrupted preferences file: $deleted")
            }

            // Also try to delete the master key file
            val masterKeyFile = File(prefsDir, "${PREFS_NAME}_master_key_")
            if (masterKeyFile.exists()) {
                masterKeyFile.delete()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error deleting corrupted preferences", e)
        }
    }

    /**
     * Save authentication token
     */
    fun saveAuthToken(token: AuthToken) {
        sharedPreferences.edit().apply {
            putString(KEY_ACCESS_TOKEN, token.accessToken)
            putString(KEY_REFRESH_TOKEN, token.refreshToken)
            token.expiresIn?.let {
                putLong(KEY_TOKEN_EXPIRY, System.currentTimeMillis() + (it * 1000))
            }
            apply()
        }
    }

    /**
     * Get authentication token
     */
    fun getAuthToken(): AuthToken? {
        val accessToken = sharedPreferences.getString(KEY_ACCESS_TOKEN, null) ?: return null
        val refreshToken = sharedPreferences.getString(KEY_REFRESH_TOKEN, null)
        val expiry = sharedPreferences.getLong(KEY_TOKEN_EXPIRY, 0)
        val expiresIn = if (expiry > 0) {
            (expiry - System.currentTimeMillis()) / 1000
        } else null

        return AuthToken(
            accessToken = accessToken,
            refreshToken = refreshToken,
            expiresIn = expiresIn
        )
    }

    /**
     * Save user information
     */
    fun saveUser(user: User) {
        sharedPreferences.edit().apply {
            putString(KEY_USER_ID, user.id)
            putString(KEY_USER_EMAIL, user.email)
            putString(KEY_USER_NAME, user.name)
            putString(KEY_USER_PICTURE, user.picture)
            putString(KEY_USER_PROVIDER, user.provider.name)
            putBoolean(KEY_USER_SURVEY_COMPLETED, user.surveyCompleted)
            apply()
        }
    }

    /**
     * Get user information
     */
    fun getUser(): User? {
        val id = sharedPreferences.getString(KEY_USER_ID, null) ?: return null
        val email = sharedPreferences.getString(KEY_USER_EMAIL, null) ?: return null
        val name = sharedPreferences.getString(KEY_USER_NAME, null)
        val picture = sharedPreferences.getString(KEY_USER_PICTURE, null)
        val providerName = sharedPreferences.getString(KEY_USER_PROVIDER, null)
        val surveyCompleted = sharedPreferences.getBoolean(KEY_USER_SURVEY_COMPLETED, false)

        val provider = try {
            AuthProvider.valueOf(providerName ?: "UNKNOWN")
        } catch (e: IllegalArgumentException) {
            AuthProvider.UNKNOWN
        }

        return User(
            id = id,
            email = email,
            name = name,
            picture = picture,
            provider = provider,
            surveyCompleted = surveyCompleted
        )
    }

    /**
     * Check if user is authenticated
     */
    fun isAuthenticated(): Boolean {
        return getAuthToken() != null && !isTokenExpired()
    }

    /**
     * Check if token is expired
     */
    fun isTokenExpired(): Boolean {
        val expiry = sharedPreferences.getLong(KEY_TOKEN_EXPIRY, 0)
        return expiry > 0 && System.currentTimeMillis() >= expiry
    }

    /**
     * Clear all session data
     */
    fun clearSession() {
        sharedPreferences.edit().clear().apply()
    }

    /**
     * Get access token for API requests
     */
    fun getAccessToken(): String? {
        return sharedPreferences.getString(KEY_ACCESS_TOKEN, null)
    }

    /**
     * Get refresh token
     */
    fun getRefreshToken(): String? {
        return sharedPreferences.getString(KEY_REFRESH_TOKEN, null)
    }
}
