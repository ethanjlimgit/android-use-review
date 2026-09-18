package com.androiduse.autopilot.survey

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.androiduse.autopilot.auth.api.RetrofitClient
import com.androiduse.autopilot.survey.model.SurveyApiResponse
import com.androiduse.autopilot.survey.model.SurveyRequest
import com.androiduse.autopilot.survey.model.SurveyResponse
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Repository for managing survey data persistence
 * Uses SharedPreferences with Gson serialization
 */
class SurveyRepository(context: Context) {

    companion object {
        private const val PREFS_NAME = "androiduse_survey_prefs"
        private const val KEY_SURVEY_RESPONSE = "survey_response"
    }

    private val sharedPreferences: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val gson = Gson()

    /**
     * Save survey response
     */
    fun saveSurveyResponse(response: SurveyResponse) {
        val json = gson.toJson(response)
        sharedPreferences.edit().apply {
            putString(KEY_SURVEY_RESPONSE, json)
            apply()
        }
    }

    /**
     * Get saved survey response
     */
    fun getSurveyResponse(): SurveyResponse? {
        val json = sharedPreferences.getString(KEY_SURVEY_RESPONSE, null) ?: return null
        return try {
            gson.fromJson(json, SurveyResponse::class.java)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Clear survey response
     */
    fun clearSurveyResponse() {
        sharedPreferences.edit().remove(KEY_SURVEY_RESPONSE).apply()
    }

    /**
     * Submit survey to backend API
     *
     * @param request Survey data formatted for API
     * @return API response or null on failure
     */
    suspend fun submitSurveyToApi(request: SurveyRequest): SurveyApiResponse? {
        return withContext(Dispatchers.IO) {
            try {
                val response = RetrofitClient.api.submitSurvey(request)

                if (response.isSuccessful) {
                    Log.d("SurveyRepository", "Survey submitted successfully: ${response.body()?.message}")
                    response.body()
                } else {
                    Log.e("SurveyRepository", "Survey submission failed: ${response.code()} - ${response.errorBody()?.string()}")
                    null
                }
            } catch (e: Exception) {
                Log.e("SurveyRepository", "Survey submission error", e)
                null
            }
        }
    }
}
