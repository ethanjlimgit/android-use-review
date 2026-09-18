"use client"

import { Suspense, useState, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import Link from "next/link"
import { Button } from "@droiduse/shared-ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Input } from "@droiduse/shared-ui/input"
import { Label } from "@droiduse/shared-ui/label"
import { Switch } from "@droiduse/shared-ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@droiduse/shared-ui/dialog"
import {
  ArrowLeft,
  Plus,
  Trash2,
  Send,
  FlaskConical,
  Save,
  Loader2,
  Code,
  Eye,
} from "lucide-react"
import { EmailPreview } from "@droiduse/email-components"

interface Sender {
  id: string
  name: string
  email: string
  isDefault: boolean
}

interface Segment {
  id: string
  name: string
}

interface CampaignVariant {
  segmentId: string
  subject: string
  preheader: string
  htmlBody: string
  textBody: string
}

function CampaignEditorContent() {
  const params = useParams<{ projectId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.projectId
  const duplicateFrom = searchParams.get("duplicate")

  const [name, setName] = useState("")
  const [senderId, setSenderId] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")
  const [sendByTimezone, setSendByTimezone] = useState(false)
  const [targetHour, setTargetHour] = useState<number | null>(null)
  const [variants, setVariants] = useState<CampaignVariant[]>([
    { segmentId: "", subject: "", preheader: "", htmlBody: "", textBody: "" },
  ])
  const [error, setError] = useState<string | null>(null)
  const [confirmSendOpen, setConfirmSendOpen] = useState(false)
  const [testEmailAddress, setTestEmailAddress] = useState("")
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [htmlEditMode, setHtmlEditMode] = useState<Record<number, "code" | "preview">>({})

  // Fetch senders
  const { data: senders } = useQuery<Sender[]>({
    queryKey: ["senders", projectId],
    queryFn: async () => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/senders`
      )
      if (!res.ok) throw new Error("Failed to fetch senders")
      return res.json()
    },
  })

  // Fetch segments
  const { data: segments } = useQuery<Segment[]>({
    queryKey: ["segments", projectId],
    queryFn: async () => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/segments`
      )
      if (!res.ok) throw new Error("Failed to fetch segments")
      return res.json()
    },
  })

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/campaigns`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            senderId: senderId || null,
            scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
            sendByTimezone,
            targetHour,
            variants: variants.map((v, i) => ({
              segmentId: v.segmentId || null,
              subject: v.subject,
              preheader: v.preheader || null,
              htmlBody: v.htmlBody,
              textBody: v.textBody || null,
              sortOrder: i,
            })),
          }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save draft")
      }
      return res.json()
    },
    onSuccess: (data) => {
      router.push(
        `/dashboard/projects/${projectId}/campaigns/${data.id}`
      )
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  // Send campaign mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      // First save
      const saveRes = await fetch(
        `/api/internal/projects/${projectId}/campaigns`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            senderId: senderId || null,
            scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
            sendByTimezone,
            targetHour,
            variants: variants.map((v, i) => ({
              segmentId: v.segmentId || null,
              subject: v.subject,
              preheader: v.preheader || null,
              htmlBody: v.htmlBody,
              textBody: v.textBody || null,
              sortOrder: i,
            })),
          }),
        }
      )
      if (!saveRes.ok) {
        const data = await saveRes.json()
        throw new Error(data.error || "Failed to save campaign")
      }
      const campaign = await saveRes.json()

      // Then send
      const sendRes = await fetch(
        `/api/internal/projects/${projectId}/campaigns/${campaign.id}/send`,
        { method: "POST" }
      )
      if (!sendRes.ok) {
        const data = await sendRes.json()
        throw new Error(data.error || "Failed to send campaign")
      }
      return campaign
    },
    onSuccess: (data) => {
      router.push(
        `/dashboard/projects/${projectId}/campaigns/${data.id}`
      )
    },
    onError: (err: Error) => {
      setError(err.message)
      setConfirmSendOpen(false)
    },
  })

  // Send test email mutation
  const sendTestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/campaigns/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: testEmailAddress,
            variant: variants[0],
            senderId: senderId || null,
          }),
        }
      )
      if (!res.ok) throw new Error("Failed to send test email")
    },
    onSuccess: () => {
      setTestDialogOpen(false)
      setTestEmailAddress("")
    },
  })

  function addVariant() {
    setVariants((prev) => [
      ...prev,
      { segmentId: "", subject: "", preheader: "", htmlBody: "", textBody: "" },
    ])
  }

  function removeVariant(index: number) {
    if (variants.length <= 1) return
    setVariants((prev) => prev.filter((_, i) => i !== index))
  }

  function updateVariant(
    index: number,
    key: keyof CampaignVariant,
    value: string
  ) {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [key]: value } : v))
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/projects/${projectId}/campaigns`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">New Campaign</h1>
          <p className="text-muted-foreground text-sm">
            Create a new email campaign
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md">
          {error}
        </div>
      )}

      {/* Campaign Details */}
      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="text-base">Campaign Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaignName">Campaign Name</Label>
            <Input
              id="campaignName"
              placeholder="e.g., January Newsletter"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sender">Sender</Label>
            <select
              id="sender"
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
            >
              <option value="">Select a sender...</option>
              {senders?.map((sender) => (
                <option key={sender.id} value={sender.id}>
                  {sender.name} ({sender.email})
                  {sender.isDefault ? " - Default" : ""}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Scheduling */}
      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="text-base">Scheduling</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scheduledAt">
              Schedule Send (optional, leave empty for immediate)
            </Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="sendByTz"
              checked={sendByTimezone}
              onCheckedChange={setSendByTimezone}
            />
            <Label htmlFor="sendByTz">
              Send by recipient timezone
            </Label>
          </div>

          {sendByTimezone && (
            <div className="space-y-2">
              <Label htmlFor="targetHour">
                Target Hour (0-23, local time)
              </Label>
              <Input
                id="targetHour"
                type="number"
                min={0}
                max={23}
                value={targetHour ?? ""}
                onChange={(e) =>
                  setTargetHour(
                    e.target.value ? parseInt(e.target.value, 10) : null
                  )
                }
                placeholder="e.g., 9 for 9:00 AM"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Variants */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Variants</h2>
          <Button variant="outline" size="sm" onClick={addVariant}>
            <Plus className="h-4 w-4" />
            Add Variant
          </Button>
        </div>

        {variants.map((variant, index) => (
          <Card key={index} className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">
                Variant {index + 1}
              </CardTitle>
              {variants.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive h-8 w-8"
                  onClick={() => removeVariant(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Target Segment (optional)</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={variant.segmentId}
                  onChange={(e) =>
                    updateVariant(index, "segmentId", e.target.value)
                  }
                >
                  <option value="">All contacts</option>
                  {segments?.map((seg) => (
                    <option key={seg.id} value={seg.id}>
                      {seg.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input
                  placeholder="Email subject"
                  value={variant.subject}
                  onChange={(e) =>
                    updateVariant(index, "subject", e.target.value)
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Preheader (optional)</Label>
                <Input
                  placeholder="Preview text shown in inbox"
                  value={variant.preheader}
                  onChange={(e) =>
                    updateVariant(index, "preheader", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>HTML Body</Label>
                  <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setHtmlEditMode((prev) => ({ ...prev, [index]: "code" }))
                      }
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                        (htmlEditMode[index] ?? "code") === "code"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Code className="h-3 w-3" />
                      Code
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setHtmlEditMode((prev) => ({ ...prev, [index]: "preview" }))
                      }
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                        htmlEditMode[index] === "preview"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Eye className="h-3 w-3" />
                      Preview
                    </button>
                  </div>
                </div>
                {(htmlEditMode[index] ?? "code") === "code" ? (
                  <textarea
                    className="w-full min-h-[200px] rounded-md border border-input bg-background p-3 text-sm font-mono resize-y"
                    placeholder="<html>...</html>"
                    value={variant.htmlBody}
                    onChange={(e) =>
                      updateVariant(index, "htmlBody", e.target.value)
                    }
                    required
                  />
                ) : (
                  <EmailPreview
                    html={variant.htmlBody}
                    subject={variant.subject}
                    preheader={variant.preheader}
                    fromName={
                      senders?.find((s) => s.id === senderId)?.name
                    }
                    fromEmail={
                      senders?.find((s) => s.id === senderId)?.email
                    }
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Plain Text (optional)</Label>
                <textarea
                  className="w-full min-h-[100px] rounded-md border border-input bg-background p-3 text-sm resize-y"
                  placeholder="Plain text version for email clients that don't support HTML"
                  value={variant.textBody}
                  onChange={(e) =>
                    updateVariant(index, "textBody", e.target.value)
                  }
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <Button
          onClick={() => saveDraftMutation.mutate()}
          disabled={
            saveDraftMutation.isPending ||
            sendMutation.isPending ||
            !name ||
            !variants[0]?.subject ||
            !variants[0]?.htmlBody
          }
          variant="outline"
        >
          {saveDraftMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Draft
        </Button>

        {/* Send Test Dialog */}
        <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <FlaskConical className="h-4 w-4" />
              Send Test
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Test Email</DialogTitle>
              <DialogDescription>Send a preview of this campaign to a test address.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                sendTestMutation.mutate()
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="testEmail">Recipient Email</Label>
                <Input
                  id="testEmail"
                  type="email"
                  placeholder="test@example.com"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={sendTestMutation.isPending}
              >
                {sendTestMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FlaskConical className="h-4 w-4" />
                )}
                Send Test Email
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Send Campaign with Confirmation */}
        <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
          <DialogTrigger asChild>
            <Button
              disabled={
                sendMutation.isPending ||
                saveDraftMutation.isPending ||
                !name ||
                !variants[0]?.subject ||
                !variants[0]?.htmlBody
              }
            >
              <Send className="h-4 w-4" />
              Send Campaign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Send</DialogTitle>
              <DialogDescription>Review the details before sending.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to send this campaign? This action cannot
                be undone.
              </p>
              <div className="bg-muted/50 p-3 rounded-md space-y-1 text-sm">
                <p>
                  <span className="font-medium">Campaign:</span> {name}
                </p>
                <p>
                  <span className="font-medium">Variants:</span>{" "}
                  {variants.length}
                </p>
                {scheduledAt && (
                  <p>
                    <span className="font-medium">Scheduled:</span>{" "}
                    {new Date(scheduledAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setConfirmSendOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => sendMutation.mutate()}
                  disabled={sendMutation.isPending}
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Confirm Send
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default function NewCampaignPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CampaignEditorContent />
    </Suspense>
  )
}
