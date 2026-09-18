import { Suspense } from "react"
import type { Metadata } from "next"
import { getSiteName } from "@/lib/settings"
import { VerifyEmailContent } from "./verify-email-content"

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName()
  return {
    title: `Verify Email - ${siteName}`,
    description: `Email verification for your ${siteName} account.`,
    robots: { index: false, follow: false },
  }
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  )
}
