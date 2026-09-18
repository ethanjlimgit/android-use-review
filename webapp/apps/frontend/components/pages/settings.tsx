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
import { Alert, AlertDescription } from "@droiduse/shared-ui/alert"
import { toast } from "@droiduse/shared-ui/use-toast"
import { Loader2, Info } from "lucide-react"

// Validation schemas
const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name is too long"),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type UpdateProfileValues = z.infer<typeof updateProfileSchema>
type ChangePasswordValues = z.infer<typeof changePasswordSchema>

export default function Settings() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)

  // Note: We can't determine from the session if user has a password set
  // The backend will handle validation - if no password exists, currentPassword is not required

  // Profile form
  const profileForm = useForm<UpdateProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: session?.user?.name || "",
    },
  })

  // Password form
  const passwordForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
  })

  // Handle profile update
  const onProfileSubmit = async (data: UpdateProfileValues) => {
    setIsProfileLoading(true)
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
      setIsProfileLoading(false)
    }
  }

  // Handle password change
  const onPasswordSubmit = async (data: ChangePasswordValues) => {
    setIsPasswordLoading(true)
    try {
      const response = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        const errorMessage = result.error || result.message || "Failed to change password"
        throw new Error(errorMessage)
      }

      toast({
        title: "Success",
        description: result.message || "Password changed successfully",
      })

      // Reset form
      passwordForm.reset()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setIsPasswordLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Settings Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile Settings Card */}
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
                    disabled={isProfileLoading}
                  />
                  {profileForm.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {profileForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isProfileLoading || !profileForm.formState.isDirty}
                  className="w-full"
                >
                  {isProfileLoading ? (
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

          {/* Password Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle>Password Settings</CardTitle>
              <CardDescription>
                Change your password or set one if you signed up with OAuth
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                {/* Info banner */}
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    If you signed up with OAuth (GitHub, Google, Twitter), leave current password blank to set a new one.
                  </AlertDescription>
                </Alert>

                {/* Current Password */}
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password (if you have one)</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder="Leave blank if you signed up with OAuth"
                    {...passwordForm.register("currentPassword")}
                    disabled={isPasswordLoading}
                  />
                  {passwordForm.formState.errors.currentPassword && (
                    <p className="text-sm text-destructive">
                      {passwordForm.formState.errors.currentPassword.message}
                    </p>
                  )}
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter new password"
                    {...passwordForm.register("newPassword")}
                    disabled={isPasswordLoading}
                  />
                  {passwordForm.formState.errors.newPassword && (
                    <p className="text-sm text-destructive">
                      {passwordForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>

                {/* Confirm New Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    {...passwordForm.register("confirmPassword")}
                    disabled={isPasswordLoading}
                  />
                  {passwordForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-destructive">
                      {passwordForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isPasswordLoading}
                  className="w-full"
                >
                  {isPasswordLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Password"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
