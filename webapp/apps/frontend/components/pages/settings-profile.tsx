"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@droiduse/shared-ui/button"
import { Input } from "@droiduse/shared-ui/input"
import { Label } from "@droiduse/shared-ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@droiduse/shared-ui/card"
import { toast } from "@droiduse/shared-ui/use-toast"
import { Loader2 } from "lucide-react"

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name is too long"),
})

type UpdateProfileValues = z.infer<typeof updateProfileSchema>

export function SettingsProfile() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const profileForm = useForm<UpdateProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: session?.user?.name || "",
    },
  })

  const onProfileSubmit = async (data: UpdateProfileValues) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        const errorMessage = result.error || result.message || "Failed to update profile"
        throw new Error(errorMessage)
      }

      // Update session
      await update()

      toast({
        title: "Success",
        description: "Profile updated successfully",
      })

      // Refresh to show updated name
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>Update your profile information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Your name"
              {...profileForm.register("name")}
              disabled={isLoading}
            />
            {profileForm.formState.errors.name && (
              <p className="text-sm text-destructive">
                {profileForm.formState.errors.name.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading || !profileForm.formState.isDirty}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Profile"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

