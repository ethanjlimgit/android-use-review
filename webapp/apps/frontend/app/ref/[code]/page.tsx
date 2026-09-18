import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { validateReferralCode } from "@droiduse/shared-lib/server"
import Link from "next/link"
import { Button } from "@droiduse/shared-ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Gift, ArrowRight, CheckCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "Join AndroidUse - Referral",
  description: "Join AndroidUse and get started with AI-powered Android automation",
}

interface ReferralPageProps {
  params: Promise<{ code: string }>
}

export default async function ReferralPage({ params }: ReferralPageProps) {
  const { code } = await params

  // Validate the referral code
  const result = await validateReferralCode(code)

  if (!result.valid) {
    // Invalid or expired referral code - redirect to regular signup
    redirect("/auth/signup")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Gift className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {result.referrerName ? `${result.referrerName} invited you!` : "You've been invited!"}
          </CardTitle>
          <CardDescription className="text-base">
            Join AndroidUse and start automating your Android device with AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">AI-Powered Automation</div>
                <div className="text-sm text-muted-foreground">
                  Automate any task on your Android device using natural language
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Bonus Credits</div>
                <div className="text-sm text-muted-foreground">
                  Get 300 bonus credits when you sign up with this referral link
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Easy Setup</div>
                <div className="text-sm text-muted-foreground">
                  Install the app, enable accessibility, and start automating
                </div>
              </div>
            </div>
          </div>

          <Button asChild className="w-full gap-2" size="lg">
            <Link href={`/auth/signup?ref=${code}`}>
              Create Account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/signin" className="underline underline-offset-4 hover:text-primary">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
