"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useAnalytics } from "@/providers/analytics-provider"
import { Button } from "@droiduse/shared-ui/button"
import { Input } from "@droiduse/shared-ui/input"
import { Label } from "@droiduse/shared-ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@droiduse/shared-ui/card"
import { Separator } from "@droiduse/shared-ui/separator"
import { Mail } from "lucide-react"
import Link from "next/link"
import { toast } from "@droiduse/shared-ui/use-toast"
import { GitHubIcon, GoogleIcon, XIcon } from "./oauth-icons"
import { ResendVerification } from "./resend-verification"

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type SignInFormValues = z.infer<typeof signInSchema>

export function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [showResendVerification, setShowResendVerification] = useState(false)
  const [attemptedEmail, setAttemptedEmail] = useState<string>("")
  const analytics = useAnalytics()

  // Get callbackUrl and product from query params
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const product = searchParams.get('product') || undefined

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
  })

  const onSubmit = async (data: SignInFormValues) => {
    setIsLoading(true)
    setAttemptedEmail(data.email)
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      // Handle CredentialsSignin error
      // See: https://authjs.dev/reference/core/errors#credentialssignin
      if (result?.error) {
        // Check if it's a CredentialsSignin error
        if (result.error === "CredentialsSignin" || result.error.includes("CredentialsSignin")) {
          analytics.capture("sign_in_failed", {
            method: "email",
            error: "Invalid credentials",
          })

          // Show a message that could be either wrong password or unverified email
          // We show the resend verification option to allow users to resend if needed
          setShowResendVerification(true)

          toast({
            title: "Authentication failed",
            description: "Invalid email or password, or your email may not be verified. Check below to resend verification if needed.",
            variant: "destructive",
          })
        } else {
          // Handle other sign-in errors
          analytics.capture("sign_in_failed", {
            method: "email",
            error: result.error,
          })
          toast({
            title: "Error",
            description: "Something went wrong during sign in. Please try again.",
            variant: "destructive",
          })
        }
      } else if (result?.ok) {
        // Successful sign-in - identify user and capture event
        analytics.identify(data.email, {
          email: data.email,
        })
        analytics.capture("user_signed_in", {
          method: "email",
        })

        // Check if user needs to complete survey
        const userResponse = await fetch('/api/user/profile')
        if (userResponse.ok) {
          const userData = await userResponse.json()
          if (!userData.surveyCompleted) {
            router.push('/onboarding')
            router.refresh()
            return
          }
        }

        router.push(callbackUrl)
        router.refresh()
      }
    } catch (error) {
      // Handle unexpected errors
      console.error("Sign-in error:", error)
      analytics.capture("sign_in_failed", {
        method: "email",
        error: error instanceof Error ? error.message : "Unknown error",
      })
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: "github" | "google" | "twitter") => {
    setIsLoading(true)
    analytics.capture("oauth_sign_in_initiated", {
      provider: provider,
    })
    await signIn(provider, { callbackUrl })
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>
          Choose your preferred sign in method
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {/* GitHub and X login hidden for now */}
          {/* <Button
            variant="outline"
            onClick={() => handleOAuthSignIn("github")}
            disabled={isLoading}
            className="w-full flex items-center justify-center bg-[#181717] text-white hover:bg-[#2d2d2d] border-[#181717]"
          >
            <GitHubIcon />
            <span className="ml-2">GitHub</span>
          </Button> */}
          <Button
            variant="outline"
            onClick={() => handleOAuthSignIn("google")}
            disabled={isLoading}
            className="w-full flex items-center justify-center bg-[#4285F4] text-white hover:bg-[#357ae8] border-[#4285F4]"
          >
            <GoogleIcon />
            <span className="ml-2">Google</span>
          </Button>
          {/* <Button
            variant="outline"
            onClick={() => handleOAuthSignIn("twitter")}
            disabled={isLoading}
            className="w-full flex items-center justify-center bg-black text-white hover:bg-[#1a1a1a] border-black"
          >
            <XIcon />
            <span className="ml-2">X</span>
          </Button> */}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with email
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...register("email")}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/auth/forgot-password"
                className="text-xs text-muted-foreground hover:text-primary underline underline-offset-4"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              {...register("password")}
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            <Mail className="mr-2 h-4 w-4" />
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-sm text-center text-muted-foreground">
          Don't have an account?{" "}
          <Link
            href={(() => {
              const params = new URLSearchParams()
              if (callbackUrl !== '/') params.set('callbackUrl', callbackUrl)
              if (product) params.set('product', product)
              const qs = params.toString()
              return `/auth/signup${qs ? `?${qs}` : ''}`
            })()}
            className="underline underline-offset-4 hover:text-primary"
          >
            Sign up
          </Link>
        </div>
      </CardFooter>
    </Card>
    {showResendVerification && (
      <div className="mt-6">
        <ResendVerification defaultEmail={attemptedEmail} requirePassword />
      </div>
    )}
  </>
  )
}

