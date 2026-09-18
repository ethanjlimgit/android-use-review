"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Button } from "@droiduse/shared-ui/button"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import Link from "next/link"

export function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token provided')
      return
    }

    async function verifyEmail() {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        })

        const data = await response.json()

        if (response.ok) {
          setStatus('success')
          setMessage(data.message)
        } else {
          setStatus('error')
          setMessage(data.message || 'Failed to verify email')
        }
      } catch (error) {
        setStatus('error')
        setMessage('An error occurred while verifying your email')
      }
    }

    verifyEmail()
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === 'loading' && (
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            )}
            {status === 'success' && (
              <CheckCircle className="h-16 w-16 text-green-600" />
            )}
            {status === 'error' && (
              <XCircle className="h-16 w-16 text-destructive" />
            )}
          </div>
          <CardTitle>
            {status === 'loading' && 'Verifying Email'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Please wait while we verify your email address...'}
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'success' && (
            <Button className="w-full" asChild>
              <Link href="/auth/signin">Continue to Sign In</Link>
            </Button>
          )}
          {status === 'error' && (
            <div className="space-y-2">
              <Button className="w-full" variant="outline" asChild>
                <Link href="/auth/signup">Create New Account</Link>
              </Button>
              <Button className="w-full" variant="ghost" asChild>
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
