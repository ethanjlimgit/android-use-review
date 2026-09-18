"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@droiduse/shared-ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Progress } from "@droiduse/shared-ui/progress"
import { Badge } from "@droiduse/shared-ui/badge"
import { Separator } from "@droiduse/shared-ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@droiduse/shared-ui/alert-dialog"
import { CreditCard, TrendingUp, AlertCircle, Loader2, Coins, Gift } from "lucide-react"
import { PRICING_TIERS_CLIENT } from "@droiduse/shared-lib"
import { useSubscription } from "@/hooks/use-subscription"
import { useToast } from "@droiduse/shared-ui/use-toast"

export function SettingsSubscription() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const { subscription, isLoading } = useSubscription()
  const { toast } = useToast()

  const handleManageSubscription = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
      })
      const { url } = await response.json()
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error("Error opening customer portal:", error)
      setLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    setCancelLoading(true)
    try {
      const response = await fetch("/api/subscription/cancel", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel subscription")
      }

      toast({
        title: "Subscription Canceled",
        description: data.message || "Your subscription has been canceled successfully.",
      })

      setShowCancelDialog(false)

      // Refresh the page to show updated subscription status
      router.refresh()
    } catch (error) {
      console.error("Error canceling subscription:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel subscription",
        variant: "destructive",
      })
    } finally {
      setCancelLoading(false)
    }
  }

  const handleReactivateSubscription = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/subscription/reactivate", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to reactivate subscription")
      }

      toast({
        title: "Subscription Reactivated",
        description: data.message || "Your subscription has been reactivated successfully.",
      })

      // Refresh the page to show updated subscription status
      router.refresh()
    } catch (error) {
      console.error("Error reactivating subscription:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reactivate subscription",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="h-2 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!subscription) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Unable to load subscription information.</p>
        </CardContent>
      </Card>
    )
  }

  const freeBonusCredits = subscription.freeBonusCredits || 0
  const totalAvailable = subscription.totalAvailableCredits || 0
  const totalCredits = subscription.creditAllowance + freeBonusCredits
  const usagePercent = totalCredits > 0
    ? ((totalCredits - totalAvailable) / totalCredits) * 100
    : 0

  const isNearLimit = totalCredits > 0 && (totalAvailable / totalCredits) < 0.2
  const isFree = subscription.tier === "free"
  const tierConfig = PRICING_TIERS_CLIENT[subscription.tier as keyof typeof PRICING_TIERS_CLIENT] || PRICING_TIERS_CLIENT.free

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Subscription
          </CardTitle>
          <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
            {subscription.tier.toUpperCase()}
          </Badge>
        </div>
        <CardDescription>
          {isFree ? "Upgrade to unlock more features" : "Manage your subscription and usage"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Cancellation Notice */}
        {subscription.cancelAtPeriodEnd && (
          <div className="space-y-3 rounded-lg border border-orange-500 bg-orange-500/10 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm text-orange-600 dark:text-orange-400">
                <p className="font-medium">Subscription Scheduled for Cancellation</p>
                <p>
                  Your subscription will end on{" "}
                  {subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd).toLocaleDateString()}.
                  You will retain access until then.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReactivateSubscription}
              disabled={loading}
              className="w-full border-orange-500 text-orange-600 hover:bg-orange-500/20 dark:text-orange-400"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reactivating...
                </>
              ) : (
                "Reactivate Subscription"
              )}
            </Button>
          </div>
        )}

        {/* Credit Usage - Show for all users */}
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <h4 className="font-medium">Credits Available</h4>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Available</span>
              <span className="font-medium">
                {totalAvailable.toLocaleString()} / {totalCredits.toLocaleString()} credits
              </span>
            </div>
            <Progress
              value={usagePercent}
              className={`h-3 ${isNearLimit ? "[&>div]:bg-orange-500" : ""}`}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{Math.round(usagePercent)}% used</span>
              <span>{totalAvailable.toLocaleString()} remaining</span>
            </div>
          </div>

          {/* Bonus Credits */}
          {freeBonusCredits > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
              <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <Gift className="h-4 w-4" />
                Bonus Credits (used first)
              </span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {freeBonusCredits.toLocaleString()}
              </span>
            </div>
          )}

          {/* Plan Credits Breakdown */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Plan Allowance</span>
              <span>{subscription.creditAllowance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Plan Credits Used</span>
              <span>{subscription.creditsUsed.toLocaleString()}</span>
            </div>
          </div>

          {isNearLimit && (
            <div className="flex items-start gap-2 rounded-lg border border-orange-500 bg-orange-500/10 p-3">
              <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-orange-600 dark:text-orange-400">
                You are running low on credits. {isFree ? "Upgrade to get more credits." : "Consider upgrading your plan."}
              </p>
            </div>
          )}

          {subscription.creditResetDate && (
            <p className="text-xs text-muted-foreground">
              Plan credits reset on {new Date(subscription.creditResetDate).toLocaleDateString()}
            </p>
          )}

          {isFree && (
            <p className="text-xs text-muted-foreground">
              1 credit = 1 second of AI agent work. Upgrade for more credits.
            </p>
          )}
        </div>

        <Separator />

        {/* Subscription Details */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-medium">{tierConfig.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
              {subscription.status}
            </Badge>
          </div>
          {subscription.currentPeriodEnd && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {subscription.cancelAtPeriodEnd ? "Access until" : "Next billing date"}
              </span>
              <span className="font-medium">
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Features List */}
        {tierConfig.features && tierConfig.features.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Plan Features</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {tierConfig.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        {isFree ? (
          <Button
            className="w-full gap-2"
            onClick={() => router.push("/pricing")}
          >
            <TrendingUp className="h-4 w-4" />
            Upgrade Plan
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleManageSubscription}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Manage Subscription"
              )}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => setShowCancelDialog(true)}
              disabled={subscription.status === "canceled" || subscription.cancelAtPeriodEnd}
            >
              {subscription.status === "canceled"
                ? "Already Canceled"
                : subscription.cancelAtPeriodEnd
                ? "Cancellation Scheduled"
                : "Cancel Subscription"}
            </Button>
          </>
        )}
      </CardFooter>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your {tierConfig.name} subscription? You will retain access until{" "}
              {subscription?.currentPeriodEnd && new Date(subscription.currentPeriodEnd).toLocaleDateString()},
              after which your account will be downgraded to the Free tier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelLoading}>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              disabled={cancelLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Canceling...
                </>
              ) : (
                "Yes, Cancel Subscription"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

