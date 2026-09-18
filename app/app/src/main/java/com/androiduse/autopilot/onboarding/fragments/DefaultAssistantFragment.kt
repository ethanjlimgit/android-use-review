package com.androiduse.autopilot.onboarding.fragments

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.androiduse.autopilot.onboarding.OnboardingViewModel
import com.androiduse.autopilot.databinding.FragmentOnboardingDefaultAssistBinding

/**
 * Default Assistant fragment - Optional step to set AndroidUse as default assistant
 */
class DefaultAssistantFragment : Fragment() {

    private var _binding: FragmentOnboardingDefaultAssistBinding? = null
    private val binding get() = _binding!!

    private val viewModel: OnboardingViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentOnboardingDefaultAssistBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupUI()
    }

    override fun onResume() {
        super.onResume()
        // Check if default assistant was set and auto-advance
        viewModel.updatePermissionStatus()
        if (viewModel.state.value.defaultAssistantSet) {
            viewModel.navigateNext()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun setupUI() {
        binding.btnOpenSettings.setOnClickListener {
            openAssistantSettings()
        }

        binding.btnSkip.setOnClickListener {
            viewModel.navigateNext()
        }
    }

    private fun openAssistantSettings() {
        try {
            val intent = Intent(Settings.ACTION_VOICE_INPUT_SETTINGS)
            startActivity(intent)
        } catch (e: Exception) {
            // If voice input settings not available, try assistant settings
            try {
                val intent = Intent("android.settings.ASSIST_GESTURE_SETTINGS")
                startActivity(intent)
            } catch (e: Exception) {
                // If both fail, just skip
                viewModel.navigateNext()
            }
        }
    }
}
