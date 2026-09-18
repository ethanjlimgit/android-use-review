"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { getEmailType } from "@droiduse/shared-lib"
import { useAnalytics } from "@/providers/analytics-provider"
import { toast } from "@droiduse/shared-ui/use-toast"
import { ProgressIndicator } from "./progress-indicator"
import { UserTypeStep } from "./user-type-step"
import { CompanySizeStep } from "./company-size-step"
import { IndustryStep } from "./industry-step"
import { OccupationStep } from "./occupation-step"
import { UseCaseStep } from "./use-case-step"

interface SurveyWizardProps {
  userEmail: string
}

interface SurveyAnswers {
  userType?: 'individual' | 'company'
  companySize?: string
  industry?: string
  occupation?: string
  useCase?: string
}

export function SurveyWizard({ userEmail }: SurveyWizardProps) {
  const router = useRouter()
  const analytics = useAnalytics()
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [answers, setAnswers] = useState<SurveyAnswers>({})
  const [emailType, setEmailType] = useState<'personal' | 'company'>()

  // Detect email type on mount
  useEffect(() => {
    const detectedType = getEmailType(userEmail)
    setEmailType(detectedType)

    // Track survey started
    analytics.capture('onboarding_survey_started', {
      email_type: detectedType,
    })
  }, [userEmail, analytics])

  // Define step sequence based on email type and user selections
  const steps = useMemo(() => {
    if (!emailType) return []

    if (emailType === 'company') {
      // Company email: skip user type question, show company flow
      return [
        { component: CompanySizeStep, key: 'companySize', props: {} },
        { component: IndustryStep, key: 'industry', props: {} },
        { component: OccupationStep, key: 'occupation', props: { isCompany: true } },
        { component: UseCaseStep, key: 'useCase', props: {} },
      ]
    }

    // Personal email: ask user type first
    const baseSteps = [
      { component: UserTypeStep, key: 'userType', props: {} },
    ]

    // If user hasn't selected type yet, only show the user type step
    if (!answers.userType) {
      return baseSteps
    }

    // If user selected company, show company flow
    if (answers.userType === 'company') {
      return [
        ...baseSteps,
        { component: CompanySizeStep, key: 'companySize', props: {} },
        { component: IndustryStep, key: 'industry', props: {} },
        { component: OccupationStep, key: 'occupation', props: { isCompany: true } },
        { component: UseCaseStep, key: 'useCase', props: {} },
      ]
    }

    // If user selected individual, show individual flow
    return [
      ...baseSteps,
      { component: OccupationStep, key: 'occupation', props: { isCompany: false } },
      { component: IndustryStep, key: 'industry', props: {} },
      { component: UseCaseStep, key: 'useCase', props: {} },
    ]
  }, [emailType, answers.userType])

  const handleNext = async (value: string) => {
    const currentStepKey = steps[currentStep].key as keyof SurveyAnswers
    const updatedAnswers = { ...answers, [currentStepKey]: value }
    setAnswers(updatedAnswers)

    // Track step completion
    analytics.capture('onboarding_step_completed', {
      step: currentStep,
      step_name: currentStepKey,
      value: value,
    })

    // Check if this is the use case step (always the last step)
    if (currentStepKey === 'useCase') {
      await submitSurvey(updatedAnswers)
    } else {
      // Move to next step
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const submitSurvey = async (finalAnswers: SurveyAnswers) => {
    setIsLoading(true)
    try {
      // Determine userType if not set (company email auto-detects as company)
      const userType = finalAnswers.userType || (emailType === 'company' ? 'company' : 'individual')

      const response = await fetch('/api/onboarding/survey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userType,
          companySize: finalAnswers.companySize || undefined,
          industry: finalAnswers.industry,
          occupation: finalAnswers.occupation,
          useCase: finalAnswers.useCase,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to save survey')
      }

      // Track survey completion
      analytics.capture('onboarding_survey_completed', {
        user_type: userType,
        company_size: finalAnswers.companySize,
        industry: finalAnswers.industry,
      })

      toast({
        title: "Welcome to DroidUse!",
        description: "Thank you for completing the survey.",
      })

      // Redirect to home page
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Survey submission error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save your survey. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!emailType || steps.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const CurrentStepComponent = steps[currentStep].component
  const currentStepKey = steps[currentStep].key as keyof SurveyAnswers
  const currentStepProps = steps[currentStep].props

  return (
    <div className="space-y-8">
      <ProgressIndicator currentStep={currentStep} totalSteps={steps.length} />
      <CurrentStepComponent
        value={answers[currentStepKey]}
        onNext={handleNext}
        onBack={currentStep > 0 ? handleBack : undefined}
        isLoading={isLoading}
        {...currentStepProps}
      />
    </div>
  )
}
