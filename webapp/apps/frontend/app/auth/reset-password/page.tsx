import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { Metadata } from "next"
import { Suspense } from "react"
import { getSiteName } from "@/lib/settings"

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName();
  return {
    title: `Reset Password - ${siteName}`,
    description: `Create a new password for your ${siteName} account.`,
    robots: { index: false, follow: false },
  };
}

function ResetPasswordContent() {
  return <ResetPasswordForm />
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Create New Password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your new password below
          </p>
        </div>
        <Suspense fallback={<div>Loading...</div>}>
          <ResetPasswordContent />
        </Suspense>
      </div>
    </div>
  )
}
