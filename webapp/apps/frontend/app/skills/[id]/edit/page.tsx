import { Navigation } from "@/components/navigation"
import SkillEdit from "@/components/pages/skill-edit"
import { storage } from "@droiduse/shared-lib/server"
import { auth } from "@/lib/auth"
import { notFound, redirect } from "next/navigation"

export default async function SkillEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  const skill = await storage.getSkillById(id)

  if (!skill) {
    notFound()
  }

  // Check if user can edit (owner or admin)
  const canEdit = skill.authorId === session.user.id || session.user.role === 'admin'

  if (!canEdit) {
    redirect(`/skills/${id}`)
  }

  return (
    <>
      <Navigation />
      <SkillEdit skill={skill} />
    </>
  )
}
