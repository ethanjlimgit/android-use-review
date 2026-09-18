package com.androiduse.autopilot.survey.fragments

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import com.androiduse.autopilot.auth.SessionManager
import com.androiduse.autopilot.config.ConfigManager
import com.androiduse.autopilot.survey.SurveyActivity
import com.androiduse.autopilot.survey.SurveyViewModel
import com.androiduse.autopilot.R
import com.androiduse.autopilot.databinding.FragmentSurveyPersonalizingBinding
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Personalizing screen fragment - Screen 6 of survey (payoff)
 * Shows animated progress messages and saves survey data
 */
class PersonalizingFragment : Fragment() {

    private var _binding: FragmentSurveyPersonalizingBinding? = null
    private val binding get() = _binding!!

    private val viewModel: SurveyViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSurveyPersonalizingBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        startPersonalizationSequence()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun startPersonalizationSequence() {
        lifecycleScope.launch {
            // Step 1: Analyzing profile
            binding.tvMessage.text = getString(R.string.survey_personalizing_analyzing)
            delay(1500)

            // Step 2: Personalizing for industry
            val industry = viewModel.state.value.industry ?: "you"
            binding.tvMessage.text = getString(R.string.survey_personalizing_customizing, industry)
            delay(1500)

            // Step 3: Save and sync (no delay, handled by API response)
            saveSurveyAndComplete()
        }
    }

    private fun saveSurveyAndComplete() {
        val sessionManager = SessionManager(requireContext())
        val user = sessionManager.getUser()

        // Check if user is a guest
        if (user == null || user.id.isNullOrBlank()) {
            // Guest user - save locally only
            viewModel.saveSurvey(null, null)

            val configManager = ConfigManager.Companion.getInstance(requireContext())
            configManager.isSurveyComplete = true

            (activity as? SurveyActivity)?.completeSurvey()
            return
        }

        // Show syncing message for authenticated users
        binding.tvMessage.text = getString(R.string.survey_personalizing_saving)

        // Authenticated user - sync to backend
        viewModel.submitSurveyToBackend(
            userId = user.id,
            email = user.email,
            scope = lifecycleScope,
            onComplete = { success ->
                if (success) {
                    Log.d("PersonalizingFragment", "Survey synced successfully")
                } else {
                    Log.w("PersonalizingFragment", "Survey saved locally only")
                }

                // Mark survey complete regardless of API result
                val configManager = ConfigManager.Companion.getInstance(requireContext())
                configManager.isSurveyComplete = true

                // Complete survey and navigate to MainActivity
                (activity as? SurveyActivity)?.completeSurvey()
            }
        )
    }
}
