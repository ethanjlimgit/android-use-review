import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@droiduse/shared-lib/server"

/**
 * Server component that checks if user has completed onboarding survey
 * Redirects to /onboarding if not completed
 *
 * Use in protected layouts:
 * ```tsx
 * export default async function Layout({ children }) {
 *   await checkOnboarding()
 *   return <>{children}</>
 * }
 * ```
 */
export async function checkOnboarding(): Promise<void> {
  const session = await auth()

  if (!session?.user?.id) {
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { surveyCompleted: true },
    })

    if (user && !user.surveyCompleted) {
      redirect("/onboarding")
    }
  } catch (error) {
    console.error("Onboarding check error:", error)
    // Continue on error to avoid breaking the app
  }
}
