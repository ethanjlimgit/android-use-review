"use client"

import { Suspense, useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@droiduse/shared-ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Mail, Loader2, CheckCircle2, XCircle, Undo2 } from "lucide-react"

type UnsubscribeState =
  | "loading"
  | "confirm"
  | "processing"
  | "done"
  | "resubscribed"
  | "error"

function UnsubscribeContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [state, setState] = useState<UnsubscribeState>("loading")
  const [email, setEmail] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const validateToken = useCallback(async () => {
    if (!token) {
      setState("error")
      setErrorMessage("Missing unsubscribe token")
      return
    }

    try {
      const res = await fetch(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`)
      if (!res.ok) {
        const data = await res.json()
        setState("error")
        setErrorMessage(data.error || "Invalid or expired token")
        return
      }
      const data = await res.json()
      setEmail(data.email || null)
      setState("confirm")
    } catch {
      setState("error")
      setErrorMessage("Failed to validate unsubscribe link")
    }
  }, [token])

  useEffect(() => {
    validateToken()
  }, [validateToken])

  async function handleUnsubscribe() {
    setState("processing")

    try {
      const res = await fetch("/api/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })

      if (!res.ok) {
        const data = await res.json()
        setState("error")
        setErrorMessage(data.error || "Failed to unsubscribe")
        return
      }

      setState("done")
    } catch {
      setState("error")
      setErrorMessage("An unexpected error occurred")
    }
  }

  async function handleResubscribe() {
    setState("processing")

    try {
      const res = await fetch("/api/email/resubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })

      if (!res.ok) {
        const data = await res.json()
        setState("error")
        setErrorMessage(data.error || "Failed to resubscribe")
        return
      }

      setState("resubscribed")
    } catch {
      setState("error")
      setErrorMessage("An unexpected error occurred")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-card-border">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Mail className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-xl">Email Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Loading State */}
          {state === "loading" && (
            <div className="flex flex-col items-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Validating your request...
              </p>
            </div>
          )}

          {/* Confirm State */}
          {state === "confirm" && (
            <div className="space-y-4 text-center">
              <p className="text-sm">
                Are you sure you want to unsubscribe
                {email && (
                  <span className="font-medium"> {email}</span>
                )}
                ?
              </p>
              <p className="text-xs text-muted-foreground">
                You will no longer receive marketing emails from us.
              </p>
              <Button onClick={handleUnsubscribe} className="w-full">
                Unsubscribe
              </Button>
            </div>
          )}

          {/* Processing State */}
          {state === "processing" && (
            <div className="flex flex-col items-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Processing your request...
              </p>
            </div>
          )}

          {/* Done State */}
          {state === "done" && (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <p className="text-sm font-medium">Successfully unsubscribed</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {email && <span>{email} has been </span>}
                  You have been removed from our mailing list.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleResubscribe}
                className="w-full"
              >
                <Undo2 className="mr-2 h-4 w-4" />
                Changed your mind? Resubscribe
              </Button>
            </div>
          )}

          {/* Resubscribed State */}
          {state === "resubscribed" && (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <p className="text-sm font-medium">
                  Successfully resubscribed
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You will continue receiving emails from us.
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {state === "error" && (
            <div className="space-y-4 text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <div>
                <p className="text-sm font-medium">Something went wrong</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {errorMessage ||
                    "Unable to process your request. Please try again."}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  )
}
