"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { industrySchema } from "@droiduse/shared-lib"
import { Button } from "@droiduse/shared-ui/button"
import { Label } from "@droiduse/shared-ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@droiduse/shared-ui/card"
import * as z from "zod"
import { INDUSTRY_OPTIONS } from "../constants"
import { useState } from "react"
import { ChoicePillGroup } from "./choice-pill-group"

interface IndustryStepProps {
  value?: string
  onNext: (value: string) => void
  onBack?: () => void
  isLoading?: boolean
}

type FormValues = z.infer<typeof industrySchema>

export function IndustryStep({ value, onNext, onBack, isLoading }: IndustryStepProps) {
  const [selectedIndustry, setSelectedIndustry] = useState(value || "")

  const {
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(industrySchema),
    defaultValues: { industry: value },
  })

  const handleIndustryChange = (value: string) => {
    setSelectedIndustry(value)
    setValue("industry", value)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>What industry are you in?</CardTitle>
        <CardDescription>
          Select the industry that best describes your work
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((data) => onNext(data.industry))} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <ChoicePillGroup
              options={INDUSTRY_OPTIONS}
              value={selectedIndustry}
              onChange={handleIndustryChange}
              disabled={isLoading}
              className="mt-1"
            />
            {errors.industry && (
              <p className="text-sm text-destructive">{errors.industry.message}</p>
            )}
          </div>

          <div className="flex gap-4">
            {onBack && (
              <Button type="button" variant="outline" onClick={onBack} disabled={isLoading}>
                Back
              </Button>
            )}
            <Button type="submit" disabled={isLoading || !selectedIndustry} className="flex-1">
              {isLoading ? "Processing..." : "Next"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
