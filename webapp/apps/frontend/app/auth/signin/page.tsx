import { Suspense } from "react"
import type { Metadata } from "next"
import { getSiteName } from "@/lib/settings"
import { SignInForm } from "@/components/auth/signin-form"
import { ProductBranding, AuthNavigation } from "@/components/auth/product-branding"

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName()
  return {
    title: `Sign In - ${siteName}`,
    description: `Sign in to your ${siteName} account to manage your devices and automations.`,
    robots: { index: false, follow: false },
  }
}

export default function SignInPage() {
  return (
    <>
      <Suspense>
        <AuthNavigation />
      </Suspense>
      <div className="flex min-h-screen w-full items-center justify-center p-4 pt-20">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col space-y-2 text-center">
            <Suspense>
              <ProductBranding />
            </Suspense>
            <h1 className="text-2xl font-semibold tracking-tight">
              Sign in to your account
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your email and password, or use a social provider
            </p>
          </div>
          <Suspense>
            <SignInForm />
          </Suspense>
        </div>
      </div>
    </>
  )
}
