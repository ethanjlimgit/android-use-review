package com.androiduse.autopilot.survey.fragments

import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.core.widget.addTextChangedListener
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.androiduse.autopilot.survey.SurveyViewModel
import com.androiduse.autopilot.R
import com.androiduse.autopilot.databinding.FragmentSurveyRoleBinding
import kotlin.collections.get

/**
 * Role screen fragment - Screen 4 of survey
 * Asks about role with ChipGroup + dynamic custom input
 */
class RoleFragment : Fragment() {

    private var _binding: FragmentSurveyRoleBinding? = null
    private val binding get() = _binding!!

    private val viewModel: SurveyViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return try {
            Log.d("RoleFragment", "Attempting to inflate layout")
            _binding = FragmentSurveyRoleBinding.inflate(inflater, container, false)
            binding.root
        } catch (e: Exception) {
            Log.e("RoleFragment", "Layout inflation failed - Material3/Material2 mismatch", e)

            // Show error to user
            Toast.makeText(
                requireContext(),
                "Layout error. Please update the app.",
                Toast.LENGTH_LONG
            ).show()

            // Return minimal fallback view to prevent app crash
            TextView(requireContext()).apply {
                text = "Error loading screen. Please contact support."
                textSize = 16f
                setPadding(48, 48, 48, 48)
                setTextColor(Color.WHITE)
                setBackgroundColor(Color.parseColor("#191919"))
            }
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        Log.d("RoleFragment", "onViewCreated called")

        // Defer text update to ensure view is fully inflated
        view.post {
            Log.d("RoleFragment", "View post block executing - updating question text")
            updateQuestionText()
        }

        setupUI()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun updateQuestionText() {
        // Defensive null check for binding
        if (_binding == null) {
            Log.w("RoleFragment", "Binding is null in updateQuestionText")
            return
        }

        // Read state with safe default
        val isCompany = viewModel.state.value.isCompany
        Log.d("RoleFragment", "Updating question text - isCompany: $isCompany")

        binding.tvQuestion.text = if (isCompany) {
            getString(R.string.survey_role_question_company)
        } else {
            getString(R.string.survey_role_question_individual)
        }
    }

    private fun setupUI() {
        binding.cgRoles.setOnCheckedStateChangeListener { _, checkedIds ->
            if (checkedIds.isEmpty()) return@setOnCheckedStateChangeListener

            val checkedId = checkedIds[0]
            val role = when (checkedId) {
                R.id.chipSoftwareEngineer -> "Software Engineer"
                R.id.chipProductManager -> "Product Manager"
                R.id.chipDesigner -> "Designer"
                R.id.chipCEO -> "CEO"
                R.id.chipFounder -> "Founder"
                R.id.chipCTO -> "CTO"
                R.id.chipEngineer -> "Engineer"
                R.id.chipDataScientist -> "Data Scientist"
                R.id.chipMarketing -> "Marketing"
                R.id.chipSales -> "Sales"
                R.id.chipCustomerSupport -> "Customer Support"
                R.id.chipOperations -> "Operations"
                R.id.chipHR -> "Human Resources"
                R.id.chipFinance -> "Finance"
                R.id.chipAnalyst -> "Analyst"
                R.id.chipManager -> "Manager"
                R.id.chipDirector -> "Director"
                R.id.chipVP -> "VP"
                R.id.chipConsultant -> "Consultant"
                R.id.chipFreelancer -> "Freelancer"
                R.id.chipStudent -> "Student"
                R.id.chipResearcher -> "Researcher"
                R.id.chipTeacher -> "Teacher"
                R.id.chipDeveloper -> "Developer"
                R.id.chipQA -> "QA/Testing"
                R.id.chipDevOps -> "DevOps"
                R.id.chipSecurity -> "Security"
                R.id.chipAdmin -> "Admin"
                R.id.chipLegal -> "Legal"
                R.id.chipOther -> {
                    // Show custom input field
                    binding.tilCustomRole.visibility = View.VISIBLE
                    binding.etCustomRole.requestFocus()
                    return@setOnCheckedStateChangeListener
                }
                else -> return@setOnCheckedStateChangeListener
            }

            // Hide custom input if visible and not "Other"
            binding.tilCustomRole.visibility = View.GONE

            // Set role and navigate
            viewModel.setRole(role)
            viewModel.navigateNext()
        }

        // Handle custom role input
        binding.etCustomRole.addTextChangedListener {
            val customRole = it.toString().trim()
            if (customRole.length >= 2) {
                viewModel.setRole("Other", customRole)
                viewModel.navigateNext()
            }
        }
    }
}
