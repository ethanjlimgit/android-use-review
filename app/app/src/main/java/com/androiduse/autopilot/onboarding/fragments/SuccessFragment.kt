package com.androiduse.autopilot.onboarding.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.OnBackPressedCallback
import androidx.fragment.app.Fragment
import com.androiduse.autopilot.onboarding.OnboardingActivity
import com.androiduse.autopilot.databinding.FragmentOnboardingSuccessBinding

/**
 * Success screen fragment - Final screen in onboarding flow
 */
class SuccessFragment : Fragment() {

    private var _binding: FragmentOnboardingSuccessBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentOnboardingSuccessBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupUI()
        disableBackButton()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun setupUI() {
        binding.btnGetStarted.setOnClickListener {
            (activity as? OnboardingActivity)?.completeOnboarding()
        }
    }

    /**
     * Disable back button on success screen
     */
    private fun disableBackButton() {
        requireActivity().onBackPressedDispatcher.addCallback(
            viewLifecycleOwner,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    // Do nothing - block back button
                }
            }
        )
    }
}
