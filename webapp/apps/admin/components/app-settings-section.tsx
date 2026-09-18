"use client"

import { useState, useEffect } from "react"
import { Button } from "@droiduse/shared-ui/button"
import { Input } from "@droiduse/shared-ui/input"
import { Label } from "@droiduse/shared-ui/label"
import { Textarea } from "@droiduse/shared-ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@droiduse/shared-ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@droiduse/shared-ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@droiduse/shared-ui/dialog"
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
import { Badge } from "@droiduse/shared-ui/badge"
import { toast } from "@droiduse/shared-ui/use-toast"
import { Loader2, Plus, Edit, Trash2, ExternalLink, Save, X } from "lucide-react"

interface AppSetting {
  id: string
  key: string
  value: string
  description: string | null
  category: string | null
  createdAt: string
  updatedAt: string
}

const CATEGORIES = [
  { value: "site", label: "Site Settings" },
  { value: "social", label: "Social Media" },
  { value: "download", label: "Download Links" },
  { value: "external", label: "External Links" },
  { value: "other", label: "Other" },
]

const DEFAULT_SETTINGS = [
  {
    key: "site.name",
    value: "Boris",
    description: "Display name of the website, used in emails and UI",
    category: "site",
  },
  {
    key: "url.playstore.internal.test",
    value: "https://play.google.com/apps/internaltest/4701595801771861010",
    description: "Internal testing link for Google Play Store",
    category: "download",
  },
  {
    key: "url.playstore.closed.beta",
    value: "https://play.google.com/apps/testing/com.androiduse.autopilot",
    description: "Closed beta link for Google Play Store",
    category: "download",
  },
  {
    key: "url.beta.google.group",
    value: "https://groups.google.com/g/boris-close-beta-testing",
    description: "Google Group for closed beta testers signup",
    category: "external",
  },
  {
    key: "url.social.github",
    value: "https://github.com/Action-State-Labs/",
    description: "GitHub organization URL",
    category: "social",
  },
  {
    key: "url.social.twitter",
    value: "https://x.com/actionstatelabs",
    description: "Twitter/X account URL",
    category: "social",
  },
  {
    key: "url.social.linkedin",
    value: "https://www.linkedin.com/company/actionstatelabs/",
    description: "LinkedIn company page URL",
    category: "social",
  },
  {
    key: "url.social.discord",
    value: "https://discord.gg/bbZKQXrhzd",
    description: "Discord community invite link",
    category: "social",
  },
]

export function AppSettingsSection() {
  const [settings, setSettings] = useState<AppSetting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>("all")

  const [formData, setFormData] = useState({
    key: "",
    value: "",
    description: "",
    category: "other",
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/settings")
      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings || [])
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch settings",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
      toast({
        title: "Error",
        description: "Failed to fetch settings",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!formData.key || !formData.value) {
      toast({
        title: "Validation Error",
        description: "Key and value are required",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Setting added successfully",
        })
        setIsAddDialogOpen(false)
        setFormData({ key: "", value: "", description: "", category: "other" })
        fetchSettings()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to add setting",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error adding setting:", error)
      toast({
        title: "Error",
        description: "Failed to add setting",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async (id: string, updates: Partial<AppSetting>) => {
    setIsSaving(true)
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Setting updated successfully",
        })
        setEditingId(null)
        fetchSettings()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to update setting",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating setting:", error)
      toast({
        title: "Error",
        description: "Failed to update setting",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/settings?id=${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Setting deleted successfully",
        })
        fetchSettings()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to delete setting",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting setting:", error)
      toast({
        title: "Error",
        description: "Failed to delete setting",
        variant: "destructive",
      })
    }
  }

  const initializeDefaults = async () => {
    setIsSaving(true)
    try {
      for (const setting of DEFAULT_SETTINGS) {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(setting),
        })
      }
      toast({
        title: "Success",
        description: "Default settings initialized",
      })
      fetchSettings()
    } catch (error) {
      console.error("Error initializing defaults:", error)
      toast({
        title: "Error",
        description: "Failed to initialize default settings",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const filteredSettings = filterCategory === "all"
    ? settings
    : settings.filter(s => s.category === filterCategory)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {settings.length === 0 && (
            <Button
              onClick={initializeDefaults}
              disabled={isSaving}
              variant="outline"
              size="sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                "Initialize Defaults"
              )}
            </Button>
          )}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Setting
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Setting</DialogTitle>
                <DialogDescription>
                  Create a new URL or configuration setting
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="key">Key</Label>
                  <Input
                    id="key"
                    placeholder="url.social.github"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="value">Value (URL)</Label>
                  <Input
                    id="value"
                    placeholder="https://github.com/..."
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Optional description..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false)
                    setFormData({ key: "", value: "", description: "", category: "other" })
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Setting"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : settings.length === 0 ? (
        <div className="text-center py-12 border rounded-md">
          <p className="text-muted-foreground mb-4">No settings configured yet</p>
          <Button onClick={initializeDefaults} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Initializing...
              </>
            ) : (
              "Initialize Default Settings"
            )}
          </Button>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSettings.map((setting) => (
                <SettingRow
                  key={setting.id}
                  setting={setting}
                  isEditing={editingId === setting.id}
                  onEdit={() => setEditingId(setting.id)}
                  onCancel={() => setEditingId(null)}
                  onSave={(updates) => handleUpdate(setting.id, updates)}
                  onDelete={() => handleDelete(setting.id)}
                  isSaving={isSaving}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

interface SettingRowProps {
  setting: AppSetting
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (updates: Partial<AppSetting>) => void
  onDelete: () => void
  isSaving: boolean
}

function SettingRow({
  setting,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  isSaving,
}: SettingRowProps) {
  const [editValue, setEditValue] = useState(setting.value)
  const [editDescription, setEditDescription] = useState(setting.description || "")

  const getCategoryBadge = (category: string | null) => {
    const categoryConfig = CATEGORIES.find(c => c.value === category)
    return (
      <Badge variant="outline">
        {categoryConfig?.label || category || "Uncategorized"}
      </Badge>
    )
  }

  if (isEditing) {
    return (
      <TableRow>
        <TableCell className="font-mono text-sm">{setting.key}</TableCell>
        <TableCell>
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="max-w-md"
          />
        </TableCell>
        <TableCell>{getCategoryBadge(setting.category)}</TableCell>
        <TableCell>
          <Input
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Optional description..."
            className="max-w-md"
          />
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              disabled={isSaving}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => onSave({ value: editValue, description: editDescription })}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{setting.key}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2 max-w-md">
          <span className="truncate text-sm">{setting.value}</span>
          {setting.value.startsWith("http") && (
            <a
              href={setting.value}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </a>
          )}
        </div>
      </TableCell>
      <TableCell>{getCategoryBadge(setting.category)}</TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {setting.description || "—"}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Edit className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Setting</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this setting? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  )
}
