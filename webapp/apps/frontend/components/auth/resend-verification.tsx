"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
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
import { toast } from "@droiduse/shared-ui/use-toast"
import { Mail } from "lucide-react"

const resendSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
})

const resendSchemaWithPassword = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type ResendFormValues = z.infer<typeof resendSchema>

interface ResendVerificationProps {
  defaultEmail?: string
  requirePassword?: boolean
}

export function ResendVerification({ defaultEmail, requirePassword = false }: ResendVerificationProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ResendFormValues>({
    resolver: zodResolver(requirePassword ? resendSchemaWithPassword : resendSchema),
    defaultValues: {
      email: defaultEmail || "",
    },
  })

  const onSubmit = async (data: ResendFormValues) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: data.email,
          ...(requirePassword && data.password && { password: data.password })
        }),
      })

      const responseData = await response.json()

      if (response.ok) {
        setIsSubmitted(true)
        toast({
          title: "Verification email sent",
          description: responseData.message,
        })
        reset()
      } else {
        // Even on error, we show success for security (don't reveal if email exists)
        // But the API already handles this properly
        toast({
          title: "Request processed",
          description: responseData.message,
        })
        reset()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send verification email. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-muted">
      <CardHeader>
        <CardTitle className="text-lg">Didn't receive verification email?</CardTitle>
        <CardDescription>
          {requirePassword
            ? "Enter your email and password to resend the verification link."
            : "Enter your email address and we'll send you a new verification link."
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resend-email">Email</Label>
            <Input
              id="resend-email"
              type="email"
              placeholder="you@example.com"
              {...register("email")}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          {requirePassword && (
            <div className="space-y-2">
              <Label htmlFor="resend-password">Password</Label>
              <Input
                id="resend-password"
                type="password"
                {...register("password")}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isLoading} variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            {isLoading ? "Sending..." : "Resend Verification Email"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
