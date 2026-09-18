"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { DataTable } from "@/components/data-table"
import { Badge } from "@droiduse/shared-ui/badge"
import { Button } from "@droiduse/shared-ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@droiduse/shared-ui/dialog"
import { Input } from "@droiduse/shared-ui/input"
import { Label } from "@droiduse/shared-ui/label"
import { Textarea } from "@droiduse/shared-ui/textarea"
import { Switch } from "@droiduse/shared-ui/switch"
import { useToast } from "@droiduse/shared-ui/use-toast"
import { Settings, Plus } from "lucide-react"

type App = {
  id: string
  name: string
  packagePath: string
  version: string
  category: string | null
  enabled: boolean
  settings: string | null
}

const PAGE_SIZE = 20

async function fetchApps(filters?: { search?: string; page?: number }) {
  const params = new URLSearchParams()
  if (filters?.search) params.append("search", filters.search)
  const page = filters?.page || 1
  params.append("limit", String(PAGE_SIZE))
  params.append("offset", String((page - 1) * PAGE_SIZE))

  const response = await fetch(`/api/admin/apps?${params}`)
  if (!response.ok) throw new Error("Failed to fetch apps")
  return response.json() as Promise<{ apps: App[]; total: number }>
}

async function createApp(appData: { name: string; packagePath: string; version: string; category?: string; iconUrl?: string }) {
  const response = await fetch("/api/admin/apps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(appData),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to create app")
  }
  return response.json()
}

async function updateApp(appId: string, updates: { settings?: string; enabled?: boolean }) {
  const response = await fetch("/api/admin/apps", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId, ...updates }),
  })
  if (!response.ok) throw new Error("Failed to update app")
  return response.json()
}

export default function AppsPage() {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedApp, setSelectedApp] = useState<App | null>(null)
  const [settings, setSettings] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    packagePath: "",
    version: "",
    category: "",
    iconUrl: "",
  })
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-apps", search, page],
    queryFn: () => fetchApps({ search: search || undefined, page }),
  })

  const apps = data?.apps ?? []
  const total = data?.total ?? 0

  const createMutation = useMutation({
    mutationFn: createApp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-apps"] })
      setCreateDialogOpen(false)
      setFormData({
        name: "",
        packagePath: "",
        version: "",
        category: "",
        iconUrl: "",
      })
      toast({
        title: "Success",
        description: "App created successfully",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create app",
        variant: "destructive",
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ appId, updates }: { appId: string; updates: { settings?: string; enabled?: boolean } }) =>
      updateApp(appId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-apps"] })
      setSettingsDialogOpen(false)
      setSelectedApp(null)
      toast({
        title: "Success",
        description: "App settings updated successfully",
      })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update app",
        variant: "destructive",
      })
    },
  })

  const toggleEnabled = (app: App) => {
    updateMutation.mutate({
      appId: app.id,
      updates: { enabled: !app.enabled },
    })
  }

  const handleSettingsClick = (app: App) => {
    setSelectedApp(app)
    try {
      const parsed = app.settings ? JSON.parse(app.settings) : {}
      setSettings(JSON.stringify(parsed, null, 2))
    } catch {
      setSettings(app.settings || "")
    }
    setSettingsDialogOpen(true)
  }

  const handleSettingsSubmit = () => {
    if (!selectedApp) return
    updateMutation.mutate({
      appId: selectedApp.id,
      updates: { settings },
    })
  }

  const handleCreateSubmit = () => {
    if (!formData.name || !formData.packagePath || !formData.version) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    createMutation.mutate({
      name: formData.name,
      packagePath: formData.packagePath,
      version: formData.version,
      category: formData.category || undefined,
      iconUrl: formData.iconUrl || undefined,
    })
  }

  const columns = [
    {
      key: "name",
      header: "App",
      render: (app: App) => (
        <div>
          <div className="font-medium">{app.name}</div>
          <div className="text-sm text-muted-foreground">{app.packagePath}</div>
        </div>
      ),
    },
    {
      key: "version",
      header: "Version",
      render: (app: App) => app.version,
    },
    {
      key: "category",
      header: "Category",
      render: (app: App) => app.category || "N/A",
    },
    {
      key: "enabled",
      header: "Status",
      render: (app: App) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={app.enabled}
            onCheckedChange={() => toggleEnabled(app)}
            disabled={updateMutation.isPending}
          />
          <Badge variant={app.enabled ? "default" : "secondary"}>
            {app.enabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (app: App) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSettingsClick(app)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Apps</h1>
          <p className="text-muted-foreground">Manage applications and settings</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create New App
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New App</DialogTitle>
              <DialogDescription>
                Add a new application to the system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">App Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., WhatsApp"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="packagePath">Package Path *</Label>
                <Input
                  id="packagePath"
                  placeholder="e.g., com.whatsapp"
                  value={formData.packagePath}
                  onChange={(e) => setFormData({ ...formData, packagePath: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="version">Version *</Label>
                <Input
                  id="version"
                  placeholder="e.g., 2.24.1"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  placeholder="e.g., communication, social, music"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="iconUrl">Icon URL</Label>
                <Input
                  id="iconUrl"
                  placeholder="https://example.com/icon.png"
                  value={formData.iconUrl}
                  onChange={(e) => setFormData({ ...formData, iconUrl: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateSubmit}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create App"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={apps}
        columns={columns}
        searchable
        searchPlaceholder="Search apps..."
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total,
          onPageChange: setPage,
        }}
      />

      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>App Settings</DialogTitle>
            <DialogDescription>
              Configure settings for {selectedApp?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings">Settings (JSON)</Label>
              <Textarea
                id="settings"
                placeholder='{"key": "value"}'
                value={settings}
                onChange={(e) => setSettings(e.target.value)}
                className="font-mono"
                rows={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSettingsSubmit}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

