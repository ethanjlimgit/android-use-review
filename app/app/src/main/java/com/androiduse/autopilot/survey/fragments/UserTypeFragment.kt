package com.androiduse.autopilot.survey.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.androiduse.autopilot.survey.SurveyViewModel
import com.androiduse.autopilot.databinding.FragmentSurveyUserTypeBinding

/**
 * User Type screen fragment - Screen 1 of survey
 * Asks whether user is an individual or company
 */
class UserTypeFragment : Fragment() {

    private var _binding: FragmentSurveyUserTypeBinding? = null
    private val binding get() = _binding!!

    private val viewModel: SurveyViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSurveyUserTypeBinding.inflate(inflater, container, false)
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
        binding.cardIndividual.setOnClickListener {
            viewModel.setUserType(isCompany = false)
            viewModel.navigateNext()
        }

        binding.cardCompany.setOnClickListener {
            viewModel.setUserType(isCompany = true)
            viewModel.navigateNext()
        }
    }
}
