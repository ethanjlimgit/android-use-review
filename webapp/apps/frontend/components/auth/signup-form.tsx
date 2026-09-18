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

const signUpSchema = z
  .object({
    name: z.union([
      z.string().min(2, "Name must be at least 2 characters"),
      z.literal(""),
    ]).optional(),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

type SignUpFormValues = z.infer<typeof signUpSchema>

export function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const analytics = useAnalytics()

  // Get callbackUrl from query params, default to "/onboarding"
  const callbackUrl = searchParams.get('callbackUrl') || '/onboarding'

  // Get referral code and product from query params
  const referralCode = searchParams.get('ref') || undefined
  const product = searchParams.get('product') || undefined

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
  })

  const onSubmit = async (data: SignUpFormValues) => {
    setIsLoading(true)
    try {
      // Create user account
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.name && data.name.trim() !== "" ? data.name : undefined,
          email: data.email,
          password: data.password,
          referralCode,
          product,
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.message || "Failed to create account")
      }

      // Set product cookie so the server knows which product the user signed up for
      if (product) {
        document.cookie = `signup_product=${encodeURIComponent(product)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
      }

      // Identify user and track signup
      analytics.identify(data.email, {
        email: data.email,
        ...(data.name && { name: data.name }),
      })
      analytics.capture("user_signed_up", {
        method: "email",
        email: data.email,
      })

      // Redirect to check-email page with email in query param
      router.push(`/auth/check-email?email=${encodeURIComponent(data.email)}`)
    } catch (error: any) {
      analytics.capture("sign_up_failed", {
        method: "email",
        error: error.message || "Unknown error",
      })
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: "github" | "google" | "twitter") => {
    setIsLoading(true)
    // OAuth signup always goes to onboarding
    await signIn(provider, { callbackUrl: '/onboarding' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>
          Choose your preferred sign up method
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {/* GitHub and X signup hidden for now */}
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
            <Label htmlFor="name">Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              {...register("name")}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
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
            <Label htmlFor="password">Password</Label>
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
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              {...register("confirmPassword")}
              disabled={isLoading}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            <Mail className="mr-2 h-4 w-4" />
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-sm text-center text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={(() => {
              const params = new URLSearchParams()
              if (callbackUrl !== '/onboarding') params.set('callbackUrl', callbackUrl)
              if (product) params.set('product', product)
              const qs = params.toString()
              return `/auth/signin${qs ? `?${qs}` : ''}`
            })()}
            className="underline underline-offset-4 hover:text-primary"
          >
            Sign in
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}

