"use client"

import { useState, useEffect } from "react"
import { Button } from "@droiduse/shared-ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Badge } from "@droiduse/shared-ui/badge"
import { Separator } from "@droiduse/shared-ui/separator"
import { Input } from "@droiduse/shared-ui/input"
import {
  Users,
  Gift,
  Copy,
  Check,
  Share2,
  Loader2,
  Coins
} from "lucide-react"
import { useToast } from "@droiduse/shared-ui/use-toast"

interface ReferralStats {
  referralCode: string
  referralCount: number
  totalCreditsEarned: number
  maxReferrals: number
  remainingReferrals: number
  referrals: Array<{
    id: string
    refereeEmail: string | null
    refereeName: string | null
    status: 'PENDING' | 'COMPLETED' | 'EXPIRED'
    bonusCredits: number
    createdAt: string
    completedAt: string | null
  }>
}

export function SettingsReferrals() {
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchReferralStats()
  }, [])

  const fetchReferralStats = async () => {
    try {
      const response = await fetch('/api/user/referral')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        throw new Error('Failed to fetch referral stats')
      }
    } catch (error) {
      console.error('Error fetching referral stats:', error)
      toast({
        title: "Error",
        description: "Failed to load referral information",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getReferralLink = () => {
    if (!stats?.referralCode) return ''
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://androiduse.com'
    return `${baseUrl}/ref/${stats.referralCode}`
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard"
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      })
    }
  }

  const handleShare = async () => {
    const referralLink = getReferralLink()
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join AndroidUse',
          text: 'Check out AndroidUse - AI-powered Android automation!',
          url: referralLink
        })
      } catch (error) {
        // User cancelled or share failed
        if ((error as Error).name !== 'AbortError') {
          copyToClipboard(referralLink)
        }
      }
    } else {
      copyToClipboard(referralLink)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Unable to load referral information.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Referral Link Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Your Referral Link
            </CardTitle>
          </div>
          <CardDescription>
            Share your referral link and you both earn 300 bonus credits when your friend signs up and verifies their account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={getReferralLink()}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(getReferralLink())}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <strong>Your referral code:</strong> <code className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono">{stats.referralCode}</code>
          </div>
        </CardContent>
      </Card>

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Referral Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-3xl font-bold text-primary">{stats.referralCount}</div>
              <div className="text-sm text-muted-foreground">Successful Referrals</div>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-3xl font-bold text-green-500">
                <Coins className="h-6 w-6" />
                {stats.totalCreditsEarned}
              </div>
              <div className="text-sm text-muted-foreground">Credits Earned</div>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-3xl font-bold">{stats.remainingReferrals}</div>
              <div className="text-sm text-muted-foreground">Referrals Remaining</div>
            </div>
          </div>

          <div className="mt-4 text-xs text-muted-foreground">
            Maximum {stats.maxReferrals} referrals allowed ({stats.maxReferrals * 300} credits max)
          </div>
        </CardContent>
      </Card>

      {/* Referral History */}
      {stats.referrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Referral History</CardTitle>
            <CardDescription>
              People who signed up using your referral link
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <div className="font-medium">
                      {referral.refereeName || referral.refereeEmail || 'Anonymous'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(referral.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        referral.status === 'COMPLETED' ? 'default' :
                        referral.status === 'PENDING' ? 'secondary' :
                        'destructive'
                      }
                    >
                      {referral.status}
                    </Badge>
                    {referral.status === 'COMPLETED' && (
                      <span className="flex items-center gap-1 text-sm font-medium text-green-500">
                        <Coins className="h-3.5 w-3.5" />
                        +{referral.bonusCredits}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
                1
              </div>
              <div>
                <div className="font-medium">Share your link</div>
                <div className="text-sm text-muted-foreground">
                  Send your unique referral link to friends and colleagues
                </div>
              </div>
            </div>
            <Separator />
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
                2
              </div>
              <div>
                <div className="font-medium">They sign up</div>
                <div className="text-sm text-muted-foreground">
                  Your friend creates an account and verifies their email
                </div>
              </div>
            </div>
            <Separator />
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
                3
              </div>
              <div>
                <div className="font-medium">You both earn credits</div>
                <div className="text-sm text-muted-foreground">
                  You and your friend each receive 300 bonus credits
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
