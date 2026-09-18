import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { Metadata } from "next"
import { getSiteName } from "@/lib/settings"

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName();
  return {
    title: `Forgot Password - ${siteName}`,
    description: `Reset your ${siteName} account password.`,
    robots: { index: false, follow: false },
  };
}

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Reset Your Password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email to receive a password reset link
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  )
}
