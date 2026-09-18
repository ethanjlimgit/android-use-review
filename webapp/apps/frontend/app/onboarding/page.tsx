import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { prisma } from '@droiduse/shared-lib/server'
import { getSiteName } from '@/lib/settings'
import { SurveyWizard } from './components/survey-wizard'

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName()
  return {
    title: `Welcome - ${siteName}`,
    description: `Complete your ${siteName} profile setup and personalize your experience.`,
    robots: { index: false, follow: false },
  }
}

export default async function OnboardingPage() {
  const session = await auth()

  // Redirect to sign in if not authenticated
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Check if survey already completed
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      surveyCompleted: true,
      email: true,
    },
  })

  // Redirect to home if survey already completed
  if (user?.surveyCompleted) {
    redirect('/')
  }

  // Ensure user has email
  if (!user?.email) {
    redirect('/auth/signin')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold mb-2">Welcome to DroidUse!</h1>
          <p className="text-muted-foreground">
            Help us personalize your experience by answering a few questions
          </p>
        </div>
        <SurveyWizard userEmail={user.email} />
      </div>
    </div>
  )
}
