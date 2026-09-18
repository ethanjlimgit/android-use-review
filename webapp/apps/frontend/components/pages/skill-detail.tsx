"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAnalytics } from "@/providers/analytics-provider"
import { format } from "date-fns"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@droiduse/shared-ui/card"
import { Button } from "@droiduse/shared-ui/button"
import { Badge } from "@droiduse/shared-ui/badge"
import { Separator } from "@droiduse/shared-ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@droiduse/shared-ui/alert-dialog"
import {
  ArrowLeft,
  Heart,
  Download,
  Star,
  Edit,
  Trash2,
  Smartphone,
  User,
  Calendar,
  Package,
} from "lucide-react"
import type { SkillWithAppAndAuthor } from "@droiduse/shared-lib"
import { useSkillLike } from "@/hooks/use-skill-like"
import { useSkillDelete } from "@/hooks/use-skill-delete"

interface SkillDetailProps {
  skill: SkillWithAppAndAuthor
  userId?: string
  userRole?: string
}

export default function SkillDetail({
  skill,
  userId,
  userRole
}: SkillDetailProps) {
  const analytics = useAnalytics()
  const router = useRouter()
  const isOwner = userId && skill.authorId === userId
  const canEdit = isOwner || userRole === 'admin'

  // Custom hooks for like and delete functionality
  const {
    isLiked,
    likeCount,
    handleLike,
    isLoading: isLiking
  } = useSkillLike({
    skillId: skill.id,
    initialLiked: skill.likes?.some(like => like.userId === userId) || false,
    initialCount: skill._count?.likes || 0,
    userId,
  })

  const {
    showDeleteDialog,
    setShowDeleteDialog,
    handleDelete,
    isDeleting
  } = useSkillDelete({
    skillId: skill.id,
  })

  // Track page view
  useEffect(() => {
    analytics.capture("skill_detail_viewed", {
      skill_id: skill.id,
      skill_title: skill.title,
      has_app: !!skill.app,
      user_is_owner: isOwner,
    })
  }, [skill.id, skill.title, skill.app, isOwner, analytics])

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => router.push("/marketplace")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Marketplace
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Smartphone className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-3xl">{skill.title}</CardTitle>
                        <Badge variant="secondary">
                          App
                        </Badge>
                      </div>
                      <CardDescription className="text-base">
                        {skill.description}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="h-4 w-4 text-primary fill-primary" />
                    <span className="font-semibold">{skill.score}</span>
                    <span className="text-muted-foreground">score</span>
                  </div>

                  <Separator orientation="vertical" className="h-6" />

                  <div className="flex items-center gap-2 text-sm">
                    <Download className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{skill.downloads}</span>
                    <span className="text-muted-foreground">downloads</span>
                  </div>

                  <Separator orientation="vertical" className="h-6" />

                  <Button
                    variant={isLiked ? "default" : "outline"}
                    size="sm"
                    onClick={handleLike}
                    disabled={isLiking}
                    className="gap-2"
                  >
                    <Heart
                      className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`}
                    />
                    <span>{likeCount}</span>
                  </Button>

                  {canEdit && (
                    <>
                      <Separator orientation="vertical" className="h-6" />

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/skills/${skill.id}/edit`)}
                        className="gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeleteDialog(true)}
                        className="gap-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* App Information */}
            {skill.app && (
              <Card>
                <CardHeader>
                  <CardTitle>Related App</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold">{skill.app.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {skill.app.packagePath}
                      </p>
                    </div>
                  </div>
                  {skill.app.category && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{skill.app.category}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Version {skill.app.version}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">About</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {skill.author && (
                  <div className="flex items-start gap-3">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Author</p>
                      <p className="font-semibold">
                        {skill.author.name || skill.author.username || "Anonymous"}
                      </p>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Created</p>
                    <p className="font-semibold">
                      {format(new Date(skill.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>

                {skill.featured && (
                  <>
                    <Separator />
                    <Badge variant="default" className="w-full justify-center">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      Featured
                    </Badge>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Skill Entry?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                skill entry &quot;{skill.title}&quot;.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
