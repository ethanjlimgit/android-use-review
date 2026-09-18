import { Suspense } from "react"
import type { Metadata } from "next"
import { getSiteName } from "@/lib/settings"
import { SignUpForm } from "@/components/auth/signup-form"
import { ProductBranding, AuthNavigation } from "@/components/auth/product-branding"

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName()
  return {
    title: `Sign Up - ${siteName}`,
    description: `Create your ${siteName} account and start automating your Android device with AI.`,
    robots: { index: false, follow: false },
  }
}

export default function SignUpPage() {
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
              Create an account
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your information to create your account
            </p>
          </div>
          <Suspense>
            <SignUpForm />
          </Suspense>
        </div>
      </div>
    </>
  )
}
