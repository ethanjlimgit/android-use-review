package com.androiduse.autopilot.onboarding.fragments

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import com.androiduse.autopilot.onboarding.OnboardingViewModel
import com.androiduse.autopilot.R
import com.androiduse.autopilot.databinding.FragmentOnboardingRecognitionGuideBinding
import kotlinx.coroutines.launch

/**
 * Recognition guide fragment - Step-by-step guide to grant speech recognition (microphone) permission
 */
class RecognitionGuideFragment : Fragment() {

    private var _binding: FragmentOnboardingRecognitionGuideBinding? = null
    private val binding get() = _binding!!

    private val viewModel: OnboardingViewModel by activityViewModels()

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        viewModel.updatePermissionStatus()
        if (isGranted) {
            viewModel.navigateNext()
        } else {
            // Show denial message
            binding.tvPermissionStatus.visibility = View.VISIBLE
            binding.tvPermissionStatus.text = getString(R.string.onboarding_recognition_permission_denied)
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentOnboardingRecognitionGuideBinding.inflate(inflater, container, false)
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

        if (viewModel.state.value.recognitionGranted) {
            viewModel.navigateNext()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun setupUI() {
        binding.btnGrantPermission.setOnClickListener {
            requestRecognitionPermission()
        }
    }

    private fun observeState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.state.collect { state ->
                updateUI(state.recognitionGuideStep)
            }
        }
    }

    private fun updateUI(step: Int) {
        // Update step indicator
        binding.tvStepIndicator.text = getString(R.string.onboarding_stepper_format, step, 2)

        // Update instruction text
        val instructionText = when (step) {
            1 -> getString(R.string.onboarding_recognition_guide_step1)
            2 -> getString(R.string.onboarding_recognition_guide_step2)
            else -> ""
        }
        binding.tvInstruction.text = instructionText
    }

    private fun requestRecognitionPermission() {
        when {
            ContextCompat.checkSelfPermission(
                requireContext(),
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED -> {
                // Permission already granted
                viewModel.updatePermissionStatus()
                viewModel.navigateNext()
            }
            shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO) -> {
                // Show rationale
                binding.tvPermissionStatus.visibility = View.VISIBLE
                binding.tvPermissionStatus.text = getString(R.string.onboarding_recognition_rationale)
                // Still request permission
                requestPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            }
            else -> {
                // Request permission directly
                binding.tvPermissionStatus.visibility = View.VISIBLE
                binding.tvPermissionStatus.text = getString(R.string.onboarding_recognition_waiting)
                requestPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
    }
}
