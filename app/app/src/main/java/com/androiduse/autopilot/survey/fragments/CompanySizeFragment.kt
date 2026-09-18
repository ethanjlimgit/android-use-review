package com.androiduse.autopilot.survey.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.androiduse.autopilot.survey.SurveyViewModel
import com.androiduse.autopilot.R
import com.androiduse.autopilot.databinding.FragmentSurveyCompanySizeBinding

/**
 * Company Size screen fragment - Screen 2 of survey
 * Asks about company size with RadioGroup options
 */
class CompanySizeFragment : Fragment() {

    private var _binding: FragmentSurveyCompanySizeBinding? = null
    private val binding get() = _binding!!

    private val viewModel: SurveyViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSurveyCompanySizeBinding.inflate(inflater, container, false)
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
        binding.rgCompanySize.setOnCheckedChangeListener { _, checkedId ->
            val size = when (checkedId) {
                R.id.rbJustMe -> "Just me"
                R.id.rb2_10 -> "2-10"
                R.id.rb11_50 -> "11-50"
                R.id.rb51_200 -> "51-200"
                R.id.rb201_1000 -> "201-1000"
                R.id.rb1000Plus -> "1000+"
                else -> return@setOnCheckedChangeListener
            }

            viewModel.setCompanySize(size)
            // Auto-advance after selection
            viewModel.navigateNext()
        }
    }
}
