import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { SettingsSidebar } from "@/components/pages/settings-sidebar"
import { checkOnboarding } from "@/components/onboarding-guard"

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/auth/signin")
  }

  await checkOnboarding()

  return (
    <>
      <Navigation />
      <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="mt-2 text-muted-foreground">
              Manage your account settings and preferences
            </p>
          </div>
          <div className="flex gap-8">
            <SettingsSidebar />
            <div className="flex-1">{children}</div>
          </div>
        </div>
      </div>
    </>
  )
}

