import { useState, useCallback } from "react"
import { useMutation } from "@tanstack/react-query"
import { useAnalytics } from "@/providers/analytics-provider"
import { useRouter } from "next/navigation"
import type { SkillLikeStatus } from "@droiduse/shared-lib"

interface UseSkillLikeOptions {
  skillId: string
  initialLiked: boolean
  initialCount: number
  userId?: string
}

export function useSkillLike({
  skillId,
  initialLiked,
  initialCount,
  userId,
}: UseSkillLikeOptions) {
  const router = useRouter()
  const analytics = useAnalytics()
  const [isLiked, setIsLiked] = useState(initialLiked)
  const [likeCount, setLikeCount] = useState(initialCount)

  const likeMutation = useMutation({
    mutationFn: async () => {
      const method = isLiked ? "DELETE" : "POST"
      const response = await fetch(`/api/skills/${skillId}/like`, {
        method,
      })

      if (!response.ok) {
        throw new Error("Failed to toggle like")
      }

      return response.json() as Promise<SkillLikeStatus>
    },
    onMutate: async () => {
      // Optimistic update
      const previousLiked = isLiked
      const previousCount = likeCount

      setIsLiked(!isLiked)
      setLikeCount(prev => isLiked ? prev - 1 : prev + 1)

      return { previousLiked, previousCount }
    },
    onSuccess: (data) => {
      setIsLiked(data.isLiked)
      setLikeCount(data.likeCount)

      analytics.capture("skill_liked", {
        skill_id: skillId,
        action: data.isLiked ? "like" : "unlike",
      })
    },
    onError: (_error, _variables, context) => {
      // Revert optimistic update
      if (context) {
        setIsLiked(context.previousLiked)
        setLikeCount(context.previousCount)
      }
    },
  })

  const handleLike = useCallback(() => {
    if (!userId) {
      router.push("/auth/signin")
      return
    }
    likeMutation.mutate()
  }, [userId, router, likeMutation])

  return {
    isLiked,
    likeCount,
    handleLike,
    isLoading: likeMutation.isPending,
  }
}
