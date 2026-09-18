"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { companySizeSchema } from "@droiduse/shared-lib"
import { Button } from "@droiduse/shared-ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@droiduse/shared-ui/card"
import * as z from "zod"
import { COMPANY_SIZE_OPTIONS } from "../constants"
import { ChoicePillGroup } from "./choice-pill-group"

interface CompanySizeStepProps {
  value?: string
  onNext: (value: string) => void
  onBack?: () => void
  isLoading?: boolean
}

type FormValues = z.infer<typeof companySizeSchema>

export function CompanySizeStep({ value, onNext, onBack, isLoading }: CompanySizeStepProps) {
  const {
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(companySizeSchema),
    defaultValues: { companySize: value as any },
  })

  const companySize = watch("companySize")

  const handleCompanySizeChange = (newValue: string) => {
    setValue("companySize", newValue as FormValues["companySize"], { shouldValidate: true })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>What's your company size?</CardTitle>
        <CardDescription>
          This helps us understand your needs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((data) => onNext(data.companySize))} className="space-y-6">
          <div className="space-y-4">
            <ChoicePillGroup
              options={COMPANY_SIZE_OPTIONS}
              value={companySize}
              onChange={handleCompanySizeChange}
              disabled={isLoading}
            />
            {errors.companySize && (
              <p className="text-sm text-destructive">{errors.companySize.message}</p>
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
