import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useAnalytics } from "@/providers/analytics-provider"

interface UseSkillDeleteOptions {
  skillId: string
}

export function useSkillDelete({ skillId }: UseSkillDeleteOptions) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const analytics = useAnalytics()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/skills/${skillId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete skill")
      }
    },
    onSuccess: () => {
      analytics.capture("skill_deleted", {
        skill_id: skillId,
      })
      queryClient.invalidateQueries({ queryKey: ["/api/skills"] })
      router.push("/marketplace")
    },
  })

  return {
    showDeleteDialog,
    setShowDeleteDialog,
    handleDelete: () => deleteMutation.mutate(),
    isDeleting: deleteMutation.isPending,
  }
}
