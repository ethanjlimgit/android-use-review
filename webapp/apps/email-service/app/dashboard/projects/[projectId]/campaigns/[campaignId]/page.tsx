"use client"

import { use, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Button } from "@droiduse/shared-ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Badge } from "@droiduse/shared-ui/badge"
import {
  ArrowLeft,
  Users,
  Eye,
  MousePointerClick,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react"
import { format } from "date-fns"
import { EmailPreview } from "@droiduse/email-components"

interface CampaignStats {
  totalRecipients: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
  unsubscribed: number
}

interface CampaignVariant {
  id: string
  subject: string
  preheader: string | null
  htmlBody: string
  segmentId: string | null
  segment?: { name: string } | null
  stats?: CampaignStats
}

interface Campaign {
  id: string
  name: string
  status: string
  scheduledAt: string | null
  sentAt: string | null
  createdAt: string
  sender?: { name: string; email: string } | null
  variants: CampaignVariant[]
  stats?: CampaignStats
}

interface Recipient {
  id: string
  contactEmail: string
  contactFirstName: string | null
  contactLastName: string | null
  variantId: string
  status: string
  sentAt: string | null
  openedAt: string | null
  clickedAt: string | null
}

interface RecipientsResponse {
  recipients: Recipient[]
  total: number
  page: number
  totalPages: number
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "default",
  sent: "default",
  paused: "secondary",
  cancelled: "destructive",
}

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; campaignId: string }>
}) {
  const { projectId, campaignId } = use(params)
  const [recipientPage, setRecipientPage] = useState(1)
  const [expandedVariants, setExpandedVariants] = useState<Record<string, boolean>>({})

  const { data: campaign, isLoading, error } = useQuery<Campaign>({
    queryKey: ["campaign", projectId, campaignId],
    queryFn: async () => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/campaigns/${campaignId}`
      )
      if (!res.ok) throw new Error("Failed to fetch campaign")
      return res.json()
    },
  })

  const { data: recipientsData } = useQuery<RecipientsResponse>({
    queryKey: ["campaignRecipients", projectId, campaignId, recipientPage],
    queryFn: async () => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/campaigns/${campaignId}/recipients?page=${recipientPage}&pageSize=25`
      )
      if (!res.ok) throw new Error("Failed to fetch recipients")
      return res.json()
    },
    enabled: !!campaign,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="p-4 text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md">
        Failed to load campaign
      </div>
    )
  }

  const stats = campaign.stats
  const openRate = stats && stats.delivered > 0
    ? ((stats.opened / stats.delivered) * 100).toFixed(1)
    : "0.0"
  const clickRate = stats && stats.delivered > 0
    ? ((stats.clicked / stats.delivered) * 100).toFixed(1)
    : "0.0"
  const bounceRate = stats && stats.sent > 0
    ? ((stats.bounced / stats.sent) * 100).toFixed(1)
    : "0.0"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/projects/${projectId}/campaigns`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <Badge
              variant={STATUS_COLORS[campaign.status] || "secondary"}
              className="capitalize"
            >
              {campaign.status}
            </Badge>
          </div>
          <div className="flex gap-3 text-sm text-muted-foreground mt-1">
            {campaign.sender && (
              <span>
                From: {campaign.sender.name} ({campaign.sender.email})
              </span>
            )}
            {campaign.sentAt && (
              <span>
                Sent {format(new Date(campaign.sentAt), "MMM d, yyyy h:mm a")}
              </span>
            )}
            {campaign.scheduledAt && !campaign.sentAt && (
              <span>
                Scheduled{" "}
                {format(
                  new Date(campaign.scheduledAt),
                  "MMM d, yyyy h:mm a"
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recipients
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.totalRecipients ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(stats?.delivered ?? 0).toLocaleString()} delivered
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Open Rate
            </CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {(stats?.opened ?? 0).toLocaleString()} opens
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Click Rate
            </CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clickRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {(stats?.clicked ?? 0).toLocaleString()} clicks
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bounce Rate
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bounceRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {(stats?.bounced ?? 0).toLocaleString()} bounced
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Variant Comparison */}
      {campaign.variants.length > 1 && (
        <Card className="border-card-border">
          <CardHeader>
            <CardTitle className="text-base">Variant Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                      Variant
                    </th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                      Subject
                    </th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                      Segment
                    </th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">
                      Sent
                    </th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">
                      Opens
                    </th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">
                      Clicks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.variants.map((variant, index) => {
                    const vs = variant.stats
                    const isExpanded = expandedVariants[variant.id] ?? false
                    return (
                      <tr
                        key={variant.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="p-3 text-sm font-medium align-top">
                          <button
                            type="button"
                            className="flex items-center gap-1 hover:text-foreground"
                            onClick={() =>
                              setExpandedVariants((prev) => ({
                                ...prev,
                                [variant.id]: !prev[variant.id],
                              }))
                            }
                          >
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${
                                isExpanded ? "" : "-rotate-90"
                              }`}
                            />
                            #{index + 1}
                          </button>
                          {isExpanded && (
                            <div className="mt-3" style={{ minWidth: 500 }}>
                              <EmailPreview
                                html={variant.htmlBody}
                                subject={variant.subject}
                                preheader={variant.preheader ?? undefined}
                                fromName={campaign.sender?.name}
                                fromEmail={campaign.sender?.email}
                                height={400}
                              />
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-sm align-top">
                          {variant.subject}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground align-top">
                          {variant.segment?.name || "All contacts"}
                        </td>
                        <td className="p-3 text-sm text-right align-top">
                          {(vs?.sent ?? 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-sm text-right align-top">
                          {(vs?.opened ?? 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-sm text-right align-top">
                          {(vs?.clicked ?? 0).toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Single variant info + preview */}
      {campaign.variants.length === 1 && (
        <Card className="border-card-border">
          <CardHeader>
            <CardTitle className="text-base">Email Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1 text-sm">
              {campaign.variants[0].segment && (
                <p>
                  <span className="font-medium">Segment:</span>{" "}
                  {campaign.variants[0].segment.name}
                </p>
              )}
            </div>
            <EmailPreview
              html={campaign.variants[0].htmlBody}
              subject={campaign.variants[0].subject}
              preheader={campaign.variants[0].preheader ?? undefined}
              fromName={campaign.sender?.name}
              fromEmail={campaign.sender?.email}
            />
          </CardContent>
        </Card>
      )}

      {/* Recipients Table */}
      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="text-base">Recipients</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recipientsData && recipientsData.recipients.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                        Email
                      </th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                        Name
                      </th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                        Sent
                      </th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                        Opened
                      </th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                        Clicked
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipientsData.recipients.map((recipient) => (
                      <tr
                        key={recipient.id}
                        className="border-b border-border last:border-0 hover:bg-muted/50"
                      >
                        <td className="p-4 text-sm font-mono">
                          {recipient.contactEmail}
                        </td>
                        <td className="p-4 text-sm">
                          {[
                            recipient.contactFirstName,
                            recipient.contactLastName,
                          ]
                            .filter(Boolean)
                            .join(" ") || (
                            <span className="text-muted-foreground">
                              --
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <Badge
                            variant={
                              recipient.status === "delivered"
                                ? "default"
                                : recipient.status === "bounced"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="text-xs capitalize"
                          >
                            {recipient.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {recipient.sentAt
                            ? format(
                                new Date(recipient.sentAt),
                                "MMM d, h:mm a"
                              )
                            : "--"}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {recipient.openedAt
                            ? format(
                                new Date(recipient.openedAt),
                                "MMM d, h:mm a"
                              )
                            : "--"}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {recipient.clickedAt
                            ? format(
                                new Date(recipient.clickedAt),
                                "MMM d, h:mm a"
                              )
                            : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {recipientsData.totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Page {recipientsData.page} of{" "}
                    {recipientsData.totalPages} ({recipientsData.total}{" "}
                    total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={recipientPage <= 1}
                      onClick={() =>
                        setRecipientPage((p) => p - 1)
                      }
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        recipientPage >= recipientsData.totalPages
                      }
                      onClick={() =>
                        setRecipientPage((p) => p + 1)
                      }
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <Users className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No recipients yet
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
