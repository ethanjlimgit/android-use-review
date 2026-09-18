"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Button } from "@droiduse/shared-ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Input } from "@droiduse/shared-ui/input"
import { Label } from "@droiduse/shared-ui/label"
import { Badge } from "@droiduse/shared-ui/badge"
import { Switch } from "@droiduse/shared-ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@droiduse/shared-ui/dialog"
import {
  ArrowLeft,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Mail,
  RefreshCw,
} from "lucide-react"
import { format } from "date-fns"

interface ApiKey {
  id: string
  projectId: string
  keyPrefix: string
  name: string | null
  scopes: string[]
  enabled: boolean
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
  key?: string
}

interface Sender {
  id: string
  name: string
  email: string
  replyTo: string | null
  isDefault: boolean
  verified: boolean
  sendgridSenderId: number | null
  address: string | null
  city: string | null
  country: string | null
  createdAt: string
}

interface Project {
  id: string
  name: string
  slug: string
  enabled: boolean
}

export default function ProjectSettingsPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId

  // Project data
  const { data: project } = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/internal/projects/${projectId}`)
      if (!res.ok) throw new Error("Failed to fetch project")
      return res.json()
    },
  })

  // API Keys
  const { data: apiKeys, isLoading: keysLoading } = useQuery<ApiKey[]>({
    queryKey: ["apiKeys", projectId],
    queryFn: async () => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/api-keys`
      )
      if (!res.ok) throw new Error("Failed to fetch API keys")
      return res.json()
    },
  })

  // Senders
  const { data: senders, isLoading: sendersLoading } = useQuery<Sender[]>({
    queryKey: ["senders", projectId],
    queryFn: async () => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/senders`
      )
      if (!res.ok) throw new Error("Failed to fetch senders")
      return res.json()
    },
  })

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/projects/${projectId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Project Settings</h1>
          <p className="text-muted-foreground text-sm">
            {project?.name ?? "Loading..."}
          </p>
        </div>
      </div>

      {/* Project Toggle */}
      <ProjectToggle projectId={projectId} project={project} />

      {/* API Keys Section */}
      <ApiKeysSection
        projectId={projectId}
        apiKeys={apiKeys}
        isLoading={keysLoading}
      />

      {/* Senders Section */}
      <SendersSection
        projectId={projectId}
        senders={senders}
        isLoading={sendersLoading}
      />
    </div>
  )
}

// ─── Project Toggle ───────────────────────────────────────────────────

function ProjectToggle({
  projectId,
  project,
}: {
  projectId: string
  project: Project | undefined
}) {
  const queryClient = useQueryClient()

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch(`/api/internal/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      if (!res.ok) throw new Error("Failed to update project")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
    },
  })

  return (
    <Card className="border-card-border">
      <CardHeader>
        <CardTitle className="text-base">Project Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {project?.enabled ? "Project is active" : "Project is disabled"}
            </p>
            <p className="text-xs text-muted-foreground">
              Disabled projects cannot send emails or accept API requests
            </p>
          </div>
          <Switch
            checked={project?.enabled ?? false}
            onCheckedChange={(checked) => toggleMutation.mutate(checked)}
            disabled={toggleMutation.isPending}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── API Keys Section ─────────────────────────────────────────────────

function ApiKeysSection({
  projectId,
  apiKeys,
  isLoading,
}: {
  projectId: string
  apiKeys: ApiKey[] | undefined
  isLoading: boolean
}) {
  const queryClient = useQueryClient()
  const [newKeyName, setNewKeyName] = useState("")
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/api-keys`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name || undefined }),
        }
      )
      if (!res.ok) throw new Error("Failed to create API key")
      return res.json() as Promise<ApiKey>
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["apiKeys", projectId] })
      setCreatedKey(data.key ?? null)
      setNewKeyName("")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/api-keys?keyId=${keyId}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("Failed to delete API key")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiKeys", projectId] })
    },
  })

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="border-card-border">
      <div className="flex items-center justify-between p-6 pb-0">
        <div className="text-base font-semibold flex items-center gap-2">
          <Key className="h-4 w-4" />
          API Keys
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setCreatedKey(null)
            setNewKeyName("")
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Create Key
            </Button>
          </DialogTrigger>
          <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {createdKey ? "API Key Created" : "Create API Key"}
            </DialogTitle>
            <DialogDescription>
              {createdKey ? "Copy your key before closing this dialog." : "Generate a new API key for this project."}
            </DialogDescription>
          </DialogHeader>
          {createdKey ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Copy this key now. It will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-muted rounded-md text-sm font-mono break-all">
                  {createdKey}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => copyKey(createdKey)}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  setDialogOpen(false)
                  setCreatedKey(null)
                }}
              >
                Done
              </Button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                createMutation.mutate(newKeyName)
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="keyName">Name (optional)</Label>
                <Input
                  id="keyName"
                  placeholder="e.g., Production API Key"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Create API Key
              </Button>
            </form>
          )}
          </DialogContent>
        </Dialog>
      </div>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : apiKeys && apiKeys.length > 0 ? (
          <div className="space-y-3">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {key.name || "Unnamed Key"}
                    </span>
                    <Badge variant={key.enabled ? "default" : "secondary"} className="text-xs">
                      {key.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    em_{key.keyPrefix}...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {format(new Date(key.createdAt), "MMM d, yyyy")}
                    {key.lastUsedAt &&
                      ` | Last used ${format(new Date(key.lastUsedAt), "MMM d, yyyy")}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm("Delete this API key? This cannot be undone.")) {
                      deleteMutation.mutate(key.id)
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No API keys yet. Create one to use the API.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Senders Section ──────────────────────────────────────────────────

function SendersSection({
  projectId,
  senders,
  isLoading,
}: {
  projectId: string
  senders: Sender[] | undefined
  isLoading: boolean
}) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [senderName, setSenderName] = useState("")
  const [senderEmail, setSenderEmail] = useState("")
  const [senderReplyTo, setSenderReplyTo] = useState("")
  const [senderIsDefault, setSenderIsDefault] = useState(false)
  const [senderAddress, setSenderAddress] = useState("")
  const [senderCity, setSenderCity] = useState("")
  const [senderCountry, setSenderCountry] = useState("US")

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/senders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: senderName,
            email: senderEmail,
            replyTo: senderReplyTo || null,
            isDefault: senderIsDefault,
            address: senderAddress,
            city: senderCity,
            country: senderCountry,
          }),
        }
      )
      if (!res.ok) throw new Error("Failed to create sender")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["senders", projectId] })
      setDialogOpen(false)
      setSenderName("")
      setSenderEmail("")
      setSenderReplyTo("")
      setSenderIsDefault(false)
      setSenderAddress("")
      setSenderCity("")
      setSenderCountry("US")
    },
  })

  const resendMutation = useMutation({
    mutationFn: async (senderId: string) => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/senders/${senderId}/verify`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("Failed to resend verification")
      return res.json()
    },
  })

  const checkStatusMutation = useMutation({
    mutationFn: async (senderId: string) => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/senders/${senderId}/verify`
      )
      if (!res.ok) throw new Error("Failed to check status")
      return res.json() as Promise<{ verified: boolean }>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["senders", projectId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (senderId: string) => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/senders?senderId=${senderId}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("Failed to delete sender")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["senders", projectId] })
    },
  })

  return (
    <Card className="border-card-border">
      <div className="flex items-center justify-between p-6 pb-0">
        <div className="text-base font-semibold flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Sender Identities
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add Sender
            </Button>
          </DialogTrigger>
          <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Sender Identity</DialogTitle>
            <DialogDescription>Configure a from address for your emails.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createMutation.mutate()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="senderName">Sender Name</Label>
              <Input
                id="senderName"
                placeholder="e.g., Acme Inc"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senderEmail">Sender Email</Label>
              <Input
                id="senderEmail"
                type="email"
                placeholder="hello@example.com"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senderReplyTo">Reply-To Email (optional)</Label>
              <Input
                id="senderReplyTo"
                type="email"
                placeholder="support@example.com"
                value={senderReplyTo}
                onChange={(e) => setSenderReplyTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senderAddress">Physical Address</Label>
              <Input
                id="senderAddress"
                placeholder="123 Main St"
                value={senderAddress}
                onChange={(e) => setSenderAddress(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Required by CAN-SPAM for email compliance</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="senderCity">City</Label>
                <Input
                  id="senderCity"
                  placeholder="San Francisco"
                  value={senderCity}
                  onChange={(e) => setSenderCity(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senderCountry">Country</Label>
                <Input
                  id="senderCountry"
                  placeholder="US"
                  value={senderCountry}
                  onChange={(e) => setSenderCountry(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="senderDefault"
                checked={senderIsDefault}
                onCheckedChange={setSenderIsDefault}
              />
              <Label htmlFor="senderDefault">Set as default sender</Label>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Add Sender
            </Button>
          </form>
          </DialogContent>
        </Dialog>
      </div>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : senders && senders.length > 0 ? (
          <div className="space-y-3">
            {senders.map((sender) => (
              <div
                key={sender.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{sender.name}</span>
                    {sender.isDefault && (
                      <Badge variant="default" className="text-xs">
                        Default
                      </Badge>
                    )}
                    {sender.sendgridSenderId ? (
                      <Badge
                        variant={sender.verified ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {sender.verified ? "Verified" : "Unverified"}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        Registration Failed
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {sender.email}
                    {sender.replyTo && ` | Reply-To: ${sender.replyTo}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!sender.verified && sender.sendgridSenderId && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => resendMutation.mutate(sender.id)}
                        disabled={resendMutation.isPending}
                      >
                        {resendMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Mail className="h-3 w-3" />
                        )}
                        Resend
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => checkStatusMutation.mutate(sender.id)}
                        disabled={checkStatusMutation.isPending}
                      >
                        {checkStatusMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Check Status
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("Delete this sender? This cannot be undone.")) {
                        deleteMutation.mutate(sender.id)
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No sender identities configured. Add one to start sending emails.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
