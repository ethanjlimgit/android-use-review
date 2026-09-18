"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useCaseSchema } from "@droiduse/shared-lib"
import { Button } from "@droiduse/shared-ui/button"
import { Textarea } from "@droiduse/shared-ui/textarea"
import { Label } from "@droiduse/shared-ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@droiduse/shared-ui/card"
import * as z from "zod"

interface UseCaseStepProps {
  value?: string
  onNext: (value: string) => void
  onBack?: () => void
  isLoading?: boolean
}

type FormValues = z.infer<typeof useCaseSchema>

export function UseCaseStep({ value, onNext, onBack, isLoading }: UseCaseStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(useCaseSchema),
    defaultValues: { useCase: value },
  })

  const useCase = watch("useCase")
  const charCount = useCase?.length || 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>What do you want to use DroidUse for?</CardTitle>
        <CardDescription>
          Tell us in one or two sentences how you plan to use our product
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((data) => onNext(data.useCase))} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="useCase">Use Case</Label>
            <Textarea
              id="useCase"
              rows={4}
              placeholder="e.g., I want to automate mobile app testing for my Android application to reduce manual testing time and improve quality assurance."
              {...register("useCase")}
              disabled={isLoading}
            />
            <div className="flex justify-between items-center">
              <div>
                {errors.useCase && (
                  <p className="text-sm text-destructive">{errors.useCase.message}</p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {charCount}/500 characters
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            {onBack && (
              <Button type="button" variant="outline" onClick={onBack} disabled={isLoading}>
                Back
              </Button>
            )}
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? "Completing..." : "Complete"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
