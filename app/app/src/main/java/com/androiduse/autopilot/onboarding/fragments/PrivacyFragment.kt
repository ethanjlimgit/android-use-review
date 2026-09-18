package com.androiduse.autopilot.onboarding.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.androiduse.autopilot.onboarding.OnboardingViewModel
import com.androiduse.autopilot.databinding.FragmentOnboardingPrivacyBinding

/**
 * Privacy screen fragment - Shown right after Welcome to reassure users about data privacy
 */
class PrivacyFragment : Fragment() {

    private var _binding: FragmentOnboardingPrivacyBinding? = null
    private val binding get() = _binding!!

    private val viewModel: OnboardingViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentOnboardingPrivacyBinding.inflate(inflater, container, false)
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
    }
}
