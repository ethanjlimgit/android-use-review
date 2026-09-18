package com.androiduse.autopilot.onboarding.fragments

import android.app.AlertDialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.androiduse.autopilot.R
import com.androiduse.autopilot.onboarding.OnboardingViewModel
import com.androiduse.autopilot.databinding.FragmentOnboardingOverlayIntroBinding

/**
 * Overlay intro fragment - Explains why overlay permission is needed
 */
class OverlayIntroFragment : Fragment() {

    private var _binding: FragmentOnboardingOverlayIntroBinding? = null
    private val binding get() = _binding!!

    private val viewModel: OnboardingViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentOnboardingOverlayIntroBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupUI()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun setupUI() {
        binding.btnContinue.setOnClickListener {
            viewModel.navigateNext()
        }

        binding.btnLearnMore.setOnClickListener {
            showLearnMoreDialog()
        }
    }

    private fun showLearnMoreDialog() {
        AlertDialog.Builder(requireContext())
            .setTitle(R.string.onboarding_overlay_title)
            .setMessage(R.string.onboarding_overlay_learn_more_message)
            .setPositiveButton(android.R.string.ok, null)
            .show()
    }
}
