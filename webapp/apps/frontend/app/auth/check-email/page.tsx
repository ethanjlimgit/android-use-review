import { Suspense } from "react"
import type { Metadata } from "next"
import { getSiteName } from "@/lib/settings"
import { CheckEmailContent } from "./check-email-content"

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName()
  return {
    title: `Check Your Email - ${siteName}`,
    description: `Verify your email address to complete your ${siteName} account setup.`,
    robots: { index: false, follow: false },
  }
}

export default function CheckEmailPage() {
  return (
    <Suspense>
      <CheckEmailContent />
    </Suspense>
  )
}
