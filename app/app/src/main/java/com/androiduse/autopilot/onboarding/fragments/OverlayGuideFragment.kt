package com.androiduse.autopilot.onboarding.fragments

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import com.androiduse.autopilot.onboarding.OnboardingViewModel
import com.androiduse.autopilot.R
import com.androiduse.autopilot.databinding.FragmentOnboardingOverlayGuideBinding
import kotlinx.coroutines.launch

/**
 * Overlay guide fragment - Step-by-step guide to grant overlay permission
 */
class OverlayGuideFragment : Fragment() {

    private var _binding: FragmentOnboardingOverlayGuideBinding? = null
    private val binding get() = _binding!!

    private val viewModel: OnboardingViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentOnboardingOverlayGuideBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupUI()
        observeState()
    }

    override fun onResume() {
        super.onResume()
        // Check if permission was granted and auto-advance
        viewModel.updatePermissionStatus()
        if (viewModel.state.value.overlayGranted) {
            viewModel.navigateNext()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun setupUI() {
        binding.btnOpenSettings.setOnClickListener {
            openOverlaySettings()
        }
    }

    private fun observeState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.state.collect { state ->
                updateUI(state.overlayGuideStep)
            }
        }
    }

    private fun updateUI(step: Int) {
        // Update step indicator
        binding.tvStepIndicator.text = getString(R.string.onboarding_stepper_format, step, 2)

        // Update instruction text
        val instructionText = when (step) {
            1 -> getString(R.string.onboarding_overlay_guide_step1)
            2 -> getString(R.string.onboarding_overlay_guide_step2)
            else -> ""
        }
        binding.tvInstruction.text = instructionText
    }

    private fun openOverlaySettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${requireContext().packageName}")
            )
            startActivity(intent)
            // Show waiting status
            binding.tvPermissionStatus.visibility = View.VISIBLE
        }
    }
}
