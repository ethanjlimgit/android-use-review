"use client"

import { useState, useEffect } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
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
import { Separator } from "@droiduse/shared-ui/separator"
import { Badge } from "@droiduse/shared-ui/badge"
import { toast } from "@droiduse/shared-ui/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@droiduse/shared-ui/alert-dialog"
import { Loader2, Info, CheckCircle2, XCircle, Trash2, AlertTriangle } from "lucide-react"
import { GitHubIcon, GoogleIcon, XIcon } from "@/components/auth/oauth-icons"

const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type ChangePasswordValues = z.infer<typeof changePasswordSchema>

interface LinkedAccount {
  provider: string
  providerAccountId: string
}

export function SettingsAccount() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)
  const [isLinkingAccount, setIsLinkingAccount] = useState<string | null>(null)
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([])
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")

  const passwordForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
  })

  // Fetch linked accounts
  useEffect(() => {
    const fetchLinkedAccounts = async () => {
      try {
        const response = await fetch("/api/user/accounts")
        if (response.ok) {
          const data = await response.json()
          setLinkedAccounts(data.accounts || [])
        }
      } catch (error) {
        console.error("Failed to fetch linked accounts:", error)
      }
    }

    fetchLinkedAccounts()
  }, [])

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

  const handleLinkAccount = async (provider: "github" | "google" | "twitter") => {
    setIsLinkingAccount(provider)
    try {
      await signIn(provider, {
        callbackUrl: "/settings/account",
        redirect: true,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to link account. Please try again.",
        variant: "destructive",
      })
      setIsLinkingAccount(null)
    }
  }

  const isAccountLinked = (provider: string) => {
    return linkedAccounts.some((account) => account.provider === provider)
  }

  const getProviderName = (provider: string) => {
    switch (provider) {
      case "github":
        return "GitHub"
      case "google":
        return "Google"
      case "twitter":
        return "X (Twitter)"
      default:
        return provider
    }
  }

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "github":
        return <GitHubIcon />
      case "google":
        return <GoogleIcon />
      case "twitter":
        return <XIcon />
      default:
        return null
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast({
        title: "Error",
        description: "Please type DELETE to confirm account deletion",
        variant: "destructive",
      })
      return
    }

    setIsDeletingAccount(true)
    try {
      const response = await fetch("/api/user/delete-account", {
        method: "DELETE",
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete account")
      }

      toast({
        title: "Account Deleted",
        description: "Your account and all associated data have been permanently deleted.",
      })

      // Sign out and redirect to home page
      await signOut({ callbackUrl: "/" })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete account. Please try again.",
        variant: "destructive",
      })
      setIsDeletingAccount(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Password Reset Section */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Change your password or set one if you signed up with OAuth
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                If you signed up with OAuth (GitHub, Google, Twitter), leave current password blank to set a new one.
              </AlertDescription>
            </Alert>

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

      <Separator />

      {/* Social Account Linking Section */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            Link your social accounts to sign in with multiple providers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(["github", "google", "twitter"] as const).map((provider) => {
            const isLinked = isAccountLinked(provider)
            const isLoading = isLinkingAccount === provider

            return (
              <div
                key={provider}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center">
                    {getProviderIcon(provider)}
                  </div>
                  <div>
                    <div className="font-medium">{getProviderName(provider)}</div>
                    <div className="text-sm text-muted-foreground">
                      {isLinked ? "Connected" : "Not connected"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isLinked && (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Linked
                    </Badge>
                  )}
                  {!isLinked && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLinkAccount(provider)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Linking...
                        </>
                      ) : (
                        "Link Account"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Separator />

      {/* Delete Account Section */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This action is irreversible. Once deleted, your account and all data will be permanently removed from our servers within 30 days. This includes:
              <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                <li>Your profile and account information</li>
                <li>All task history and execution logs</li>
                <li>Connected OAuth accounts</li>
                <li>Subscription and billing information</li>
                <li>Knowledge entries you've created</li>
              </ul>
            </AlertDescription>
          </Alert>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full"
                disabled={isDeletingAccount}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete My Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Are you absolutely sure?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    This will permanently delete your account and remove all your data from our servers.
                    This action <strong>cannot be undone</strong>.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="deleteConfirmation" className="text-foreground">
                      Please type <strong>DELETE</strong> to confirm:
                    </Label>
                    <Input
                      id="deleteConfirmation"
                      type="text"
                      placeholder="Type DELETE"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      disabled={isDeletingAccount}
                    />
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  disabled={isDeletingAccount}
                  onClick={() => setDeleteConfirmation("")}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount || deleteConfirmation !== "DELETE"}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeletingAccount ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Account
                    </>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}

