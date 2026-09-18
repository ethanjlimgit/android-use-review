"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Button } from "@droiduse/shared-ui/button"
import { Input } from "@droiduse/shared-ui/input"
import { Label } from "@droiduse/shared-ui/label"
import { useToast } from "@droiduse/shared-ui/use-toast"
import { Lock, Mail, Loader2 } from "lucide-react"

export default function AdminLoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      // Handle CredentialsSignin error
      // See: https://authjs.dev/reference/core/errors#credentialssignin
      if (result?.error) {
        // Check if it's a CredentialsSignin error
        if (result.error === "CredentialsSignin" || result.error.includes("CredentialsSignin")) {
          toast({
            title: "Authentication failed",
            description: "Invalid email or password, or you don't have admin access",
            variant: "destructive",
          })
        } else {
          // Handle other sign-in errors
          toast({
            title: "Error",
            description: "Something went wrong during sign in. Please try again.",
            variant: "destructive",
          })
        }
      } else if (result?.ok) {
        // Successful sign-in
        router.push("/")
        router.refresh()
      }
    } catch (error) {
      // Handle unexpected errors
      console.error("Sign-in error:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo/Header Section */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Portal</h1>
          <p className="text-muted-foreground">Sign in to access the CMS</p>
        </div>

        {/* Login Card */}
        <Card className="border-2 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-semibold">Welcome back</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10 h-11"
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10 h-11"
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 text-base font-medium" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Protected admin area. Unauthorized access is prohibited.
        </p>
      </div>
    </div>
  )
}

