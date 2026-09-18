"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { occupationSchema } from "@droiduse/shared-lib"
import { Button } from "@droiduse/shared-ui/button"
import { Input } from "@droiduse/shared-ui/input"
import { Label } from "@droiduse/shared-ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@droiduse/shared-ui/card"
import * as z from "zod"
import { useState } from "react"
import { ChoicePillGroup } from "./choice-pill-group"
import { JOB_TITLE_OPTIONS } from "../constants"

interface OccupationStepProps {
  value?: string
  onNext: (value: string) => void
  onBack?: () => void
  isLoading?: boolean
  isCompany?: boolean
}

type FormValues = z.infer<typeof occupationSchema>

export function OccupationStep({ value, onNext, onBack, isLoading, isCompany }: OccupationStepProps) {
  // Check if the initial value matches any of our predefined options
  const initialOption = value ? JOB_TITLE_OPTIONS.find(opt => opt.label === value || opt.value === value) : undefined
  const [selectedJobTitle, setSelectedJobTitle] = useState<string | undefined>(
    initialOption?.value
  )
  const [showCustomInput, setShowCustomInput] = useState(
    !!value && !initialOption
  )
  const [customValue, setCustomValue] = useState(value && !initialOption ? value : "")

  const {
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(occupationSchema),
    defaultValues: { occupation: value },
  })

  const occupation = watch("occupation")

  const title = isCompany ? "What's your role?" : "What's your job title?"
  const description = isCompany
    ? "Select your role or enter a custom one"
    : "Select your job title or enter a custom one"
  const placeholder = isCompany ? "e.g., CEO, CTO, Product Manager" : "e.g., Software Engineer, Designer"

  const handleJobTitleSelect = (jobTitleValue: string) => {
    // Find the label for the selected value
    const selectedOption = JOB_TITLE_OPTIONS.find(opt => opt.value === jobTitleValue)
    const displayValue = selectedOption?.label || jobTitleValue
    setSelectedJobTitle(jobTitleValue)
    setShowCustomInput(false)
    setCustomValue("")
    setValue("occupation", displayValue, { shouldValidate: true })
  }

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    setCustomValue(inputValue)
    setSelectedJobTitle(undefined)
    setValue("occupation", inputValue, { shouldValidate: true })
  }

  const handleShowCustomInput = () => {
    setShowCustomInput(true)
    setSelectedJobTitle(undefined)
    setValue("occupation", customValue, { shouldValidate: true })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((data) => onNext(data.occupation))} className="space-y-6">
          <div className="space-y-4">
            <ChoicePillGroup
              options={JOB_TITLE_OPTIONS}
              value={selectedJobTitle}
              onChange={handleJobTitleSelect}
              disabled={isLoading}
            />

            <div className="space-y-2 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Don't see what you're looking for?
              </p>
              {showCustomInput ? (
                <div className="space-y-2">
                  <Input
                    id="occupation"
                    type="text"
                    placeholder={placeholder}
                    value={customValue}
                    onChange={handleCustomInputChange}
                    disabled={isLoading}
                  />
                  {errors.occupation && (
                    <p className="text-sm text-destructive">{errors.occupation.message}</p>
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleShowCustomInput}
                  disabled={isLoading}
                  className="w-full"
                >
                  Describe your role...
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            {onBack && (
              <Button type="button" variant="outline" onClick={onBack} disabled={isLoading}>
                Back
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={isLoading || !occupation} 
              className="flex-1"
            >
              {isLoading ? "Processing..." : "Next"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
