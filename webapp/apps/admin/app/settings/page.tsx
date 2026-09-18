"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Button } from "@droiduse/shared-ui/button"
import { useToast } from "@droiduse/shared-ui/use-toast"
import {
  Database,
  Download,
  Trash2,
  Loader2,
  AlertTriangle,
  Bean,
  FileDown,
  Settings2,
  Coins,
  Users,
  RefreshCw
} from "lucide-react"
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
import { AppSettingsSection } from "@/components/app-settings-section"

interface CreditStats {
  usersWithZeroCredits: number
  totalUsers: number
  totalCreditsUsed: number
  avgCreditsUsed: number
}

export default function SettingsPage() {
  const { toast } = useToast()
  const [isSeeding, setIsSeeding] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [creditStats, setCreditStats] = useState<CreditStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const isDevelopment = process.env.NODE_ENV === "development"

  const fetchCreditStats = async () => {
    setIsLoadingStats(true)
    try {
      const response = await fetch("/api/admin/migrate-credits")
      if (response.ok) {
        const data = await response.json()
        setCreditStats(data)
      }
    } catch (error) {
      console.error("Failed to fetch credit stats:", error)
    } finally {
      setIsLoadingStats(false)
    }
  }

  useEffect(() => {
    fetchCreditStats()
  }, [])

  const handleMigrateCredits = async () => {
    setIsMigrating(true)
    try {
      const response = await fetch("/api/admin/migrate-credits", {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to migrate credits")
      }

      const result = await response.json()
      toast({
        title: "Success",
        description: result.message,
      })
      // Refresh stats after migration
      fetchCreditStats()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to migrate credits",
        variant: "destructive",
      })
    } finally {
      setIsMigrating(false)
    }
  }

  const handleSeedData = async () => {
    setIsSeeding(true)
    try {
      const response = await fetch("/api/admin/settings/seed", {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to seed data")
      }

      const result = await response.json()
      toast({
        title: "Success",
        description: result.message || "Data seeded successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to seed data",
        variant: "destructive",
      })
    } finally {
      setIsSeeding(false)
    }
  }

  const handleExportData = async (type: "all" | "users" | "blog" | "apps" | "skills") => {
    setIsExporting(true)
    try {
      const response = await fetch(`/api/admin/settings/export?type=${type}`, {
        method: "GET",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to export data")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `export-${type}-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Success",
        description: `Data exported successfully`,
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export data",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteData = async (type: "all" | "users" | "blog" | "apps" | "skills") => {
    setIsDeleting(true)
    try {
      const response = await fetch("/api/admin/settings/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete data")
      }

      const result = await response.json()
      toast({
        title: "Success",
        description: result.message || "Data deleted successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete data",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage app settings, database operations, and data
        </p>
      </div>

      <div className="grid gap-6">
        {/* App Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              App Settings
            </CardTitle>
            <CardDescription>
              Manage external URLs, social media links, and download links
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AppSettingsSection />
          </CardContent>
        </Card>

        {/* Credit Migration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Credit Migration
            </CardTitle>
            <CardDescription>
              Migrate existing users with 0 credits to free tier (600 credits)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingStats ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading stats...
              </div>
            ) : creditStats && (
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <div className="text-sm text-muted-foreground">Users with 0 Credits</div>
                  <div className="text-2xl font-bold text-orange-500">{creditStats.usersWithZeroCredits}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-sm text-muted-foreground">Total Users</div>
                  <div className="text-2xl font-bold">{creditStats.totalUsers}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-sm text-muted-foreground">Total Credits Used</div>
                  <div className="text-2xl font-bold">{creditStats.totalCreditsUsed.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-sm text-muted-foreground">Avg Credits/User</div>
                  <div className="text-2xl font-bold">{creditStats.avgCreditsUsed.toLocaleString()}</div>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={handleMigrateCredits}
                disabled={isMigrating || (creditStats?.usersWithZeroCredits === 0)}
                variant="default"
              >
                {isMigrating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Migrating...
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Migrate Users ({creditStats?.usersWithZeroCredits || 0})
                  </>
                )}
              </Button>
              <Button
                onClick={fetchCreditStats}
                disabled={isLoadingStats}
                variant="outline"
                size="icon"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingStats ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Seeding - Only in development */}
        {isDevelopment && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bean className="h-5 w-5" />
                Data Seeding
              </CardTitle>
              <CardDescription>
                Populate the database with sample data for testing and development
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleSeedData}
                disabled={isSeeding}
                variant="default"
              >
                {isSeeding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Seeding...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Seed Database
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Data Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Data Export
            </CardTitle>
            <CardDescription>
              Export data from the database as JSON files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleExportData("all")}
              disabled={isExporting}
              variant="outline"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Export All
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Data Deletion - Only in development */}
        {isDevelopment && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Data Deletion
              </CardTitle>
              <CardDescription className="text-destructive/80">
                Permanently delete data from the database. This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={isDeleting}
                    variant="destructive"
                    className="w-full"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete All Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete ALL data from the database including users, blog posts, apps, and skills. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeleteData("all")}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={isDeleting}
                    variant="destructive"
                    className="w-full"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Users
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete All Users?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all users from the database. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeleteData("users")}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Users
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={isDeleting}
                    variant="destructive"
                    className="w-full"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Blog Posts
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete All Blog Posts?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all blog posts from the database. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeleteData("blog")}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Blog Posts
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={isDeleting}
                    variant="destructive"
                    className="w-full"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Apps
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete All Apps?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all apps from the database. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeleteData("apps")}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Apps
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={isDeleting}
                    variant="destructive"
                    className="w-full"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Skills
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete All Skills?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all skill entries from the database. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeleteData("skills")}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Skills
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  )
}
