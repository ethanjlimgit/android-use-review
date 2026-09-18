import { Navigation } from "@/components/navigation"
import SkillDetail from "@/components/pages/skill-detail"
import { storage } from "@droiduse/shared-lib/server"
import { auth } from "@/lib/auth"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const skill = await storage.getSkillByIdDetailed(id)

  if (!skill) {
    return {
      title: "Skill Not Found",
    }
  }

  const metadata: Metadata = {
    title: `${skill.title} - Droiduse Marketplace`,
    description: skill.description,
    keywords: [
      'skill',
      skill.app?.name || '',
      skill.app?.category || '',
    ].filter(Boolean),
    authors: skill.author ? [{
      name: skill.author.name || skill.author.username || "Unknown"
    }] : undefined,
    openGraph: {
      title: skill.title,
      description: skill.description,
      type: "article",
      images: skill.app?.iconUrl ? [skill.app.iconUrl] : undefined,
    },
  }

  return metadata
}

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const skill = await storage.getSkillByIdDetailed(id, session?.user?.id)

  if (!skill) {
    notFound()
  }

  return (
    <>
      <Navigation />
      <SkillDetail
        skill={skill}
        userId={session?.user?.id}
        userRole={session?.user?.role}
      />
    </>
  )
}
