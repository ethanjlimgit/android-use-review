"use client"

import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Button } from "@droiduse/shared-ui/button"
import { Mail } from "lucide-react"
import Link from "next/link"
import { ResendVerification } from "@/components/auth/resend-verification"

export function CheckEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              {email ? (
                <>
                  We sent a verification link to <strong>{email}</strong>
                </>
              ) : (
                "We sent you a verification link"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              <p className="mb-2">Please check your inbox and click the verification link to activate your account.</p>
              <p className="text-xs">If you don't see the email, check your spam folder.</p>
            </div>
            <Button className="w-full" asChild>
              <Link href="/auth/signin">Continue to Sign In</Link>
            </Button>
          </CardContent>
        </Card>

        <ResendVerification defaultEmail={email || undefined} requirePassword />
      </div>
    </div>
  )
}
