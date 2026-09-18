"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { DataTable } from "@/components/data-table"
import { Badge } from "@droiduse/shared-ui/badge"
import { Button } from "@droiduse/shared-ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@droiduse/shared-ui/dialog"
import { Input } from "@droiduse/shared-ui/input"
import { Label } from "@droiduse/shared-ui/label"
import { Textarea } from "@droiduse/shared-ui/textarea"
import { useToast } from "@droiduse/shared-ui/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@droiduse/shared-ui/dropdown-menu"
import { format } from "date-fns"
import { Ban, CheckCircle2, MapPin, Trash2, MoreVertical, Shield, ShieldOff } from "lucide-react"

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
  lastLoginIp: string | null
  lastLoginCountry: string | null
  lastLoginCity: string | null
  lastLoginAt: Date | null
  _count: {
    tasks: number
  }
}

const PAGE_SIZE = 20

async function fetchUsers(filters?: { search?: string; role?: string; banned?: string; page?: number }) {
  const params = new URLSearchParams()
  if (filters?.search) params.append("search", filters.search)
  if (filters?.role) params.append("role", filters.role)
  if (filters?.banned !== undefined) params.append("banned", filters.banned)
  const page = filters?.page || 1
  params.append("limit", String(PAGE_SIZE))
  params.append("offset", String((page - 1) * PAGE_SIZE))

  const response = await fetch(`/api/admin/users?${params}`)
  if (!response.ok) throw new Error("Failed to fetch users")
  return response.json() as Promise<{ users: User[]; total: number }>
}

async function banUser(userId: string, banned: boolean, reason?: string) {
  const response = await fetch("/api/admin/users", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, banned, bannedReason: reason }),
  })
  if (!response.ok) throw new Error("Failed to update user")
  return response.json()
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

async function changeUserRole(userId: string, role: string) {
  const response = await fetch("/api/admin/users", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, role }),
  })
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || "Failed to update user role")
  }
  return response.json()
}

export default function UsersPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [bannedFilter, setBannedFilter] = useState("")
  const [page, setPage] = useState(1)
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [banReason, setBanReason] = useState("")
  const [newRole, setNewRole] = useState<"user" | "admin">("user")
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, roleFilter, bannedFilter, page],
    queryFn: () => fetchUsers({
      search: search || undefined,
      role: roleFilter || undefined,
      banned: bannedFilter || undefined,
      page,
    }),
  })

  const users = data?.users ?? []
  const total = data?.total ?? 0

  const banMutation = useMutation({
    mutationFn: ({ userId, banned, reason }: { userId: string; banned: boolean; reason?: string }) =>
      banUser(userId, banned, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      setBanDialogOpen(false)
      setSelectedUser(null)
      setBanReason("")
      toast({
        title: "Success",
        description: selectedUser?.banned ? "User unbanned successfully" : "User banned successfully",
      })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      setDeleteDialogOpen(false)
      setSelectedUser(null)
      toast({
        title: "Success",
        description: "User deleted successfully",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      })
    },
  })

  const roleChangeMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      changeUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      setRoleDialogOpen(false)
      setSelectedUser(null)
      toast({
        title: "Success",
        description: "User role updated successfully",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      })
    },
  })

  const handleBanClick = (user: User, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click
    setSelectedUser(user)
    setBanReason(user.bannedReason || "")
    setBanDialogOpen(true)
  }

  const handleDeleteClick = (user: User, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click
    setSelectedUser(user)
    setDeleteDialogOpen(true)
  }

  const handleRoleClick = (user: User, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click
    setSelectedUser(user)
    setNewRole(user.role === "admin" ? "user" : "admin")
    setRoleDialogOpen(true)
  }

  const handleRowClick = (user: User) => {
    router.push(`/users/${user.id}`)
  }

  const handleBanSubmit = () => {
    if (!selectedUser) return
    banMutation.mutate({
      userId: selectedUser.id,
      banned: !selectedUser.banned,
      reason: banReason || undefined,
    })
  }

  const handleDeleteSubmit = () => {
    if (!selectedUser) return
    deleteMutation.mutate(selectedUser.id)
  }

  const handleRoleSubmit = () => {
    if (!selectedUser) return
    roleChangeMutation.mutate({
      userId: selectedUser.id,
      role: newRole,
    })
  }

  const columns = [
    {
      key: "email",
      header: "User",
      render: (user: User) => (
        <div className="cursor-pointer" onClick={() => handleRowClick(user)}>
          <div className="font-medium">{user.name || user.email || "Unknown"}</div>
          <div className="text-sm text-muted-foreground">{user.email}</div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (user: User) => (
        <div className="cursor-pointer" onClick={() => handleRowClick(user)}>
          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
            {user.role}
          </Badge>
        </div>
      ),
    },
    {
      key: "banned",
      header: "Status",
      render: (user: User) => (
        <div className="cursor-pointer" onClick={() => handleRowClick(user)}>
          <Badge variant={user.banned ? "destructive" : "default"}>
            {user.banned ? "Banned" : "Active"}
          </Badge>
        </div>
      ),
    },
    {
      key: "tasks",
      header: "Tasks",
      render: (user: User) => (
        <div className="cursor-pointer" onClick={() => handleRowClick(user)}>
          {user._count.tasks}
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Joined",
      render: (user: User) => (
        <div className="cursor-pointer" onClick={() => handleRowClick(user)}>
          {format(new Date(user.createdAt), "MMM d, yyyy")}
        </div>
      ),
    },
    {
      key: "location",
      header: "Last Location",
      render: (user: User) => (
        <div className="cursor-pointer" onClick={() => handleRowClick(user)}>
          {user.lastLoginCountry || user.lastLoginCity ? (
            <div className="flex items-center gap-1 text-sm">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span>
                {[user.lastLoginCity, user.lastLoginCountry].filter(Boolean).join(", ")}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (user: User) => {
        const isCurrentUser = session?.user?.id === user.id
        return (
          <div className="flex items-center gap-2">
            <Button
              variant={user.banned ? "default" : "destructive"}
              size="sm"
              onClick={(e) => handleBanClick(user, e)}
            >
              {user.banned ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Unban
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4 mr-2" />
                  Ban
                </>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => handleRoleClick(user, e)}
                  disabled={isCurrentUser}
                >
                  {user.role === "admin" ? (
                    <>
                      <ShieldOff className="h-4 w-4 mr-2" />
                      Demote to User
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Promote to Admin
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => handleDeleteClick(user, e)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground">Manage user accounts and permissions</p>
      </div>

      <DataTable
        data={users}
        columns={columns}
        searchable
        searchPlaceholder="Search users..."
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        filterable
        filters={[
          {
            key: "role",
            label: "Role",
            options: [
              { value: "", label: "All Roles" },
              { value: "user", label: "User" },
              { value: "admin", label: "Admin" },
            ],
          },
          {
            key: "banned",
            label: "Status",
            options: [
              { value: "", label: "All" },
              { value: "false", label: "Active" },
              { value: "true", label: "Banned" },
            ],
          },
        ]}
        onFilterChange={(filters) => {
          setRoleFilter(filters.role || "")
          setBannedFilter(filters.banned || "")
          setPage(1)
        }}
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total,
          onPageChange: setPage,
        }}
      />

      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.banned ? "Unban User" : "Ban User"}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.banned
                ? "Are you sure you want to unban this user?"
                : "Enter a reason for banning this user (optional)"}
            </DialogDescription>
          </DialogHeader>
          {!selectedUser?.banned && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Ban Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for banning..."
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={selectedUser?.banned ? "default" : "destructive"}
              onClick={handleBanSubmit}
              disabled={banMutation.isPending}
            >
              {banMutation.isPending
                ? "Processing..."
                : selectedUser?.banned
                ? "Unban User"
                : "Ban User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">User:</span>
                <span className="text-sm">{selectedUser.name || selectedUser.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Email:</span>
                <span className="text-sm">{selectedUser.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Tasks:</span>
                <span className="text-sm">{selectedUser._count.tasks}</span>
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

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              {newRole === "admin"
                ? "Are you sure you want to promote this user to admin? They will have full access to the admin panel."
                : "Are you sure you want to demote this user to regular user? They will lose access to the admin panel."}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">User:</span>
                <span className="text-sm">{selectedUser.name || selectedUser.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Email:</span>
                <span className="text-sm">{selectedUser.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Current Role:</span>
                <Badge variant={selectedUser.role === "admin" ? "default" : "secondary"}>
                  {selectedUser.role}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">New Role:</span>
                <Badge variant={newRole === "admin" ? "default" : "secondary"}>
                  {newRole}
                </Badge>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={newRole === "admin" ? "default" : "destructive"}
              onClick={handleRoleSubmit}
              disabled={roleChangeMutation.isPending}
            >
              {roleChangeMutation.isPending
                ? "Updating..."
                : newRole === "admin"
                ? "Promote to Admin"
                : "Demote to User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

