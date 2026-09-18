import { Navigation } from "@/components/navigation"
import DeviceTasks from "@/components/pages/device-tasks"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    redirect("/auth/signin")
  }

  const { id } = await params

  return (
    <>
      <Navigation />
      <DeviceTasks deviceId={id} />
    </>
  )
}
