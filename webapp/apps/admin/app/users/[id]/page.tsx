"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { Badge } from "@droiduse/shared-ui/badge"
import { Button } from "@droiduse/shared-ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@droiduse/shared-ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@droiduse/shared-ui/table"
import { useToast } from "@droiduse/shared-ui/use-toast"
import { format } from "date-fns"
import { ArrowLeft, User as UserIcon, Brain, Smartphone, MapPin, Globe, Trash2 } from "lucide-react"

type UserMemory = {
  id: string
  type: string
  value: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

type Device = {
  id: string
  name: string
  deviceId: string
  deviceTypeId: string
  osVersion: string | null
  status: string
  lastActive: Date | null
  createdAt: Date
  longitude: number | null
  latitude: number | null
  locationUpdatedAt: Date | null
}

type User = {
  id: string
  name: string | null
  email: string | null
  username: string | null
  role: string
  banned: boolean
  bannedAt: Date | null
  bannedReason: string | null
  createdAt: Date
  image: string | null
  stripeCustomerId: string | null
  subscriptionTier: string | null
  subscriptionStatus: string | null
  creditAllowance: number
  creditsUsed: number
  surveyCompleted: boolean
  userType: string | null
  companySize: string | null
  industry: string | null
  occupation: string | null
  useCase: string | null
  lastLoginIp: string | null
  lastLoginCountry: string | null
  lastLoginCity: string | null
  lastLoginAt: Date | null
  memories: UserMemory[]
  _count: {
    tasks: number
    skillEntries: number
    accounts: number
  }
}

async function fetchUser(id: string) {
  const response = await fetch(`/api/admin/users/${id}`)
  if (!response.ok) throw new Error("Failed to fetch user")
  const data = await response.json()
  return data as { user: User; devices: Device[] }
}

async function deleteUser(userId: string) {
  const response = await fetch(`/api/admin/users/${userId}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || "Failed to delete user")
  }
  return response.json()
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => fetchUser(userId),
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      setDeleteDialogOpen(false)
      toast({
        title: "Success",
        description: "User deleted successfully",
      })
      router.push("/users")
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      })
    },
  })

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true)
  }

  const handleDeleteSubmit = () => {
    deleteMutation.mutate(userId)
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!data) {
    return <div>User not found</div>
  }

  const { user, devices } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/users")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDeleteClick}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete User
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">User Profile</h1>
        <p className="text-muted-foreground">View user information, memories, and devices</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              User Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.image && (
              <div>
                <img
                  src={user.image}
                  alt={user.name || "User"}
                  className="w-20 h-20 rounded-full"
                />
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-muted-foreground">Name</div>
              <div className="mt-1">{user.name || "N/A"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Email</div>
              <div className="mt-1">{user.email || "N/A"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Username</div>
              <div className="mt-1">{user.username || "N/A"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Role</div>
              <div className="mt-1">
                <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Status</div>
              <div className="mt-1">
                <Badge variant={user.banned ? "destructive" : "default"}>
                  {user.banned ? "Banned" : "Active"}
                </Badge>
              </div>
            </div>
            {user.banned && user.bannedReason && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Ban Reason</div>
                <div className="mt-1 text-sm">{user.bannedReason}</div>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-muted-foreground">Joined</div>
              <div className="mt-1">{format(new Date(user.createdAt), "MMM d, yyyy")}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription & Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Subscription Tier</div>
              <div className="mt-1">
                <Badge>{user.subscriptionTier || "free"}</Badge>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Subscription Status</div>
              <div className="mt-1">
                <Badge variant={user.subscriptionStatus === "active" ? "default" : "secondary"}>
                  {user.subscriptionStatus || "inactive"}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Credit Usage</div>
              <div className="mt-1">
                {user.creditsUsed.toLocaleString()} / {user.creditAllowance.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Stripe Customer ID</div>
              <div className="mt-1 font-mono text-xs">{user.stripeCustomerId || "N/A"}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Location & IP
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Last Login IP</div>
              <div className="mt-1 font-mono text-sm">{user.lastLoginIp || "N/A"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Location</div>
              <div className="mt-1 flex items-center gap-1">
                {user.lastLoginCity || user.lastLoginCountry ? (
                  <>
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{[user.lastLoginCity, user.lastLoginCountry].filter(Boolean).join(", ")}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">N/A</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Last Login</div>
              <div className="mt-1">
                {user.lastLoginAt
                  ? format(new Date(user.lastLoginAt), "MMM d, yyyy HH:mm:ss")
                  : "N/A"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Tasks</div>
                <div className="mt-1 text-2xl font-bold">{user._count.tasks}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Skill Entries</div>
                <div className="mt-1 text-2xl font-bold">{user._count.skillEntries}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Connected Accounts</div>
                <div className="mt-1 text-2xl font-bold">{user._count.accounts}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {user.surveyCompleted && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Survey Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {user.userType && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">User Type</div>
                    <div className="mt-1">{user.userType}</div>
                  </div>
                )}
                {user.companySize && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Company Size</div>
                    <div className="mt-1">{user.companySize}</div>
                  </div>
                )}
                {user.industry && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Industry</div>
                    <div className="mt-1">{user.industry}</div>
                  </div>
                )}
                {user.occupation && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Occupation</div>
                    <div className="mt-1">{user.occupation}</div>
                  </div>
                )}
              </div>
              {user.useCase && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Use Case</div>
                  <div className="mt-1">{user.useCase}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            User Memories ({user.memories.length})
          </CardTitle>
          <CardDescription>Stored user preferences and context</CardDescription>
        </CardHeader>
        <CardContent>
          {user.memories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No memories recorded
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.memories.map((memory) => (
                  <TableRow key={memory.id}>
                    <TableCell>
                      <Badge variant="outline">{memory.type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {memory.description || "-"}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="text-sm truncate">{memory.value}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(memory.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(memory.updatedAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Devices ({devices.length})
          </CardTitle>
          <CardDescription>User's registered devices</CardDescription>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No devices registered
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Device ID</TableHead>
                  <TableHead>OS Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-medium">{device.name}</TableCell>
                    <TableCell className="font-mono text-sm">{device.deviceId}</TableCell>
                    <TableCell>{device.osVersion || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant={device.status === "online" ? "default" : "secondary"}>
                        {device.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {device.latitude && device.longitude ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono">
                            {device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {device.lastActive
                        ? format(new Date(device.lastActive), "MMM d, yyyy HH:mm")
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(device.createdAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {user && (
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">User:</span>
                <span className="text-sm">{user.name || user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Email:</span>
                <span className="text-sm">{user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Tasks:</span>
                <span className="text-sm">{user._count.tasks}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Skill Entries:</span>
                <span className="text-sm">{user._count.skillEntries}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Devices:</span>
                <span className="text-sm">{devices.length}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSubmit}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
