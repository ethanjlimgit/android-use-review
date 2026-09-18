"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Button } from "@droiduse/shared-ui/button"
import { Card, CardContent } from "@droiduse/shared-ui/card"
import { Badge } from "@droiduse/shared-ui/badge"
import {
  ArrowLeft,
  Plus,
  Send,
  Eye,
  Copy,
  Pause,
  XCircle,
  Loader2,
} from "lucide-react"
import { format } from "date-fns"

interface Campaign {
  id: string
  name: string
  status: string
  scheduledAt: string | null
  sentAt: string | null
  createdAt: string
  _count?: {
    recipients: number
  }
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "default",
  sent: "default",
  paused: "secondary",
  cancelled: "destructive",
}

export default function CampaignsPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>("")

  const { data: campaigns, isLoading, error } = useQuery<Campaign[]>({
    queryKey: ["campaigns", projectId, statusFilter],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (statusFilter) searchParams.set("status", statusFilter)
      const res = await fetch(
        `/api/internal/projects/${projectId}/campaigns?${searchParams}`
      )
      if (!res.ok) throw new Error("Failed to fetch campaigns")
      return res.json()
    },
  })

  const pauseMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/campaigns/${campaignId}/pause`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("Failed to pause campaign")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", projectId] })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/campaigns/${campaignId}/cancel`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("Failed to cancel campaign")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", projectId] })
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/campaigns/${campaignId}/duplicate`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("Failed to duplicate campaign")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", projectId] })
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/projects/${projectId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground text-sm">
            Create and manage email campaigns
          </p>
        </div>
        <Link href={`/dashboard/projects/${projectId}/campaigns/new`}>
          <Button>
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="sending">Sending</option>
          <option value="sent">Sent</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="p-4 text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md">
          Failed to load campaigns
        </div>
      ) : campaigns && campaigns.length > 0 ? (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="border-card-border">
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{campaign.name}</span>
                    <Badge
                      variant={STATUS_COLORS[campaign.status] || "secondary"}
                      className="text-xs capitalize"
                    >
                      {campaign.status}
                    </Badge>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>
                      {(campaign._count?.recipients ?? 0).toLocaleString()}{" "}
                      recipients
                    </span>
                    {campaign.scheduledAt && (
                      <span>
                        Scheduled:{" "}
                        {format(
                          new Date(campaign.scheduledAt),
                          "MMM d, yyyy h:mm a"
                        )}
                      </span>
                    )}
                    {campaign.sentAt && (
                      <span>
                        Sent:{" "}
                        {format(
                          new Date(campaign.sentAt),
                          "MMM d, yyyy h:mm a"
                        )}
                      </span>
                    )}
                    <span>
                      Created{" "}
                      {format(new Date(campaign.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/dashboard/projects/${projectId}/campaigns/${campaign.id}`}
                  >
                    <Button variant="ghost" size="icon" title="View">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Duplicate"
                    onClick={() => duplicateMutation.mutate(campaign.id)}
                    disabled={duplicateMutation.isPending}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {(campaign.status === "sending" ||
                    campaign.status === "scheduled") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Pause"
                      onClick={() => pauseMutation.mutate(campaign.id)}
                      disabled={pauseMutation.isPending}
                    >
                      <Pause className="h-4 w-4" />
                    </Button>
                  )}
                  {campaign.status !== "sent" &&
                    campaign.status !== "cancelled" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Cancel"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (
                            confirm("Cancel this campaign? This cannot be undone.")
                          ) {
                            cancelMutation.mutate(campaign.id)
                          }
                        }}
                        disabled={cancelMutation.isPending}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Send className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first email campaign
            </p>
            <Link href={`/dashboard/projects/${projectId}/campaigns/new`}>
              <Button>
                <Plus className="h-4 w-4" />
                Create Campaign
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
