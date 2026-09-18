package com.androiduse.autopilot.survey.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.widget.addTextChangedListener
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.androiduse.autopilot.survey.SurveyViewModel
import com.androiduse.autopilot.databinding.FragmentSurveyUseCaseBinding

/**
 * Use Case screen fragment - Screen 5 of survey
 * Asks about use case with multiline text input
 */
class UseCaseFragment : Fragment() {

    private var _binding: FragmentSurveyUseCaseBinding? = null
    private val binding get() = _binding!!

    private val viewModel: SurveyViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSurveyUseCaseBinding.inflate(inflater, container, false)
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
        binding.etUseCase.addTextChangedListener {
            val text = it.toString().trim()
            val isValid = text.length in 10..500

            binding.btnFinish.isEnabled = isValid

            if (text.isNotEmpty() && text.length < 10) {
                binding.tilUseCase.error = "Please enter at least 10 characters"
            } else {
                binding.tilUseCase.error = null
            }

            if (isValid) {
                viewModel.setUseCase(text)
            }
        }

        binding.btnFinish.setOnClickListener {
            viewModel.navigateNext()
        }
    }
}
