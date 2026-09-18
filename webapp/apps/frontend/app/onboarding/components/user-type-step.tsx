"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { userTypeSelectionSchema } from "@droiduse/shared-lib"
import { Button } from "@droiduse/shared-ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@droiduse/shared-ui/card"
import * as z from "zod"
import { ChoicePillGroup } from "./choice-pill-group"

interface UserTypeStepProps {
  value?: string
  onNext: (value: string) => void
  onBack?: () => void
  isLoading?: boolean
}

type FormValues = z.infer<typeof userTypeSelectionSchema>

export function UserTypeStep({ value, onNext, onBack, isLoading }: UserTypeStepProps) {
  const {
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(userTypeSelectionSchema),
    defaultValues: { userType: value as 'individual' | 'company' },
  })

  const userType = watch("userType")

  const handleUserTypeChange = (newValue: string) => {
    setValue("userType", newValue as FormValues["userType"], { shouldValidate: true })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Are you an individual or a company?</CardTitle>
        <CardDescription>
          This helps us personalize your experience
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((data) => onNext(data.userType))} className="space-y-6">
          <div className="space-y-4">
            <ChoicePillGroup
              options={[
                { value: "individual", label: "Individual" },
                { value: "company", label: "Company" },
              ]}
              value={userType}
              onChange={handleUserTypeChange}
              disabled={isLoading}
            />
            {errors.userType && (
              <p className="text-sm text-destructive">{errors.userType.message}</p>
            )}
          </div>

          <div className="flex gap-4">
            {onBack && (
              <Button type="button" variant="outline" onClick={onBack} disabled={isLoading}>
                Back
              </Button>
            )}
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? "Processing..." : "Next"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
