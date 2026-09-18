package com.androiduse.autopilot.survey.fragments

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.androiduse.autopilot.survey.SurveyViewModel
import com.androiduse.autopilot.R
import com.androiduse.autopilot.databinding.FragmentSurveyIndustryBinding
import kotlin.collections.get

/**
 * Industry screen fragment - Screen 3 of survey
 * Asks about industry with ChipGroup options
 */
class IndustryFragment : Fragment() {

    private var _binding: FragmentSurveyIndustryBinding? = null
    private val binding get() = _binding!!

    private val viewModel: SurveyViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSurveyIndustryBinding.inflate(inflater, container, false)
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
        binding.chipGroupIndustry.setOnCheckedStateChangeListener { _, checkedIds ->
            if (checkedIds.isEmpty()) {
                binding.btnNext.isEnabled = false
                return@setOnCheckedStateChangeListener
            }

            val checkedId = checkedIds[0]
            val industry = when (checkedId) {
                R.id.chipTechnology -> "Technology"
                R.id.chipHealthcare -> "Healthcare"
                R.id.chipFinance -> "Finance"
                R.id.chipEducation -> "Education"
                R.id.chipRetail -> "Retail"
                R.id.chipManufacturing -> "Manufacturing"
                R.id.chipRealEstate -> "Real Estate"
                R.id.chipTransportation -> "Transportation"
                R.id.chipMarketing -> "Marketing"
                R.id.chipLegal -> "Legal"
                R.id.chipNonProfit -> "Non-Profit"
                R.id.chipGovernment -> "Government"
                R.id.chipEntertainment -> "Entertainment"
                R.id.chipHospitality -> "Hospitality"
                R.id.chipConstruction -> "Construction"
                R.id.chipAgriculture -> "Agriculture"
                R.id.chipOther -> "Other"
                else -> return@setOnCheckedStateChangeListener
            }

            viewModel.setIndustry(industry)
            binding.btnNext.isEnabled = true
        }

        binding.btnNext.setOnClickListener {
            Log.d("IndustryFragment", "Next button clicked - Current state: industry=${viewModel.state.value.industry}, isCompany=${viewModel.state.value.isCompany}")

            try {
                viewModel.navigateNext()
                Log.d("IndustryFragment", "Navigation initiated successfully")
            } catch (e: Exception) {
                Log.e("IndustryFragment", "Error during navigation", e)

                // Ensure guest user defaults are set
                if (viewModel.state.value.industry == null) {
                    Log.w("IndustryFragment", "Industry is null, setting default 'Other'")
                    viewModel.setIndustry("Other")
                }

                // Force navigation to next screen with fail-safe
                try {
                    viewModel.navigateNext()
                    Log.d("IndustryFragment", "Retry navigation successful")
                } catch (e2: Exception) {
                    Log.e("IndustryFragment", "Retry navigation also failed", e2)
                    // If still failing, show error to user
                    Toast.makeText(
                        requireContext(),
                        "Navigation error. Please try again.",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }
    }
}
