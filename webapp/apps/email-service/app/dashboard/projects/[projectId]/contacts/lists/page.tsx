"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Button } from "@droiduse/shared-ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Input } from "@droiduse/shared-ui/input"
import { Label } from "@droiduse/shared-ui/label"
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
  Plus,
  Trash2,
  BookUser,
  Loader2,
} from "lucide-react"
import { format } from "date-fns"

interface ContactList {
  id: string
  name: string
  description: string | null
  createdAt: string
  _count?: {
    members: number
  }
}

export default function ContactListsPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [listName, setListName] = useState("")
  const [listDescription, setListDescription] = useState("")

  const { data: lists, isLoading, error } = useQuery<ContactList[]>({
    queryKey: ["contactLists", projectId],
    queryFn: async () => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/contacts/lists`
      )
      if (!res.ok) throw new Error("Failed to fetch contact lists")
      return res.json()
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/contacts/lists`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: listName,
            description: listDescription || null,
          }),
        }
      )
      if (!res.ok) throw new Error("Failed to create list")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contactLists", projectId] })
      setDialogOpen(false)
      setListName("")
      setListDescription("")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (listId: string) => {
      const res = await fetch(
        `/api/internal/projects/${projectId}/contacts/lists/${listId}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("Failed to delete list")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contactLists", projectId] })
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/projects/${projectId}/contacts`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Contact Lists</h1>
          <p className="text-muted-foreground text-sm">
            Organize contacts into lists for targeted campaigns
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              New List
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Contact List</DialogTitle>
              <DialogDescription>Add a new list to organize your contacts.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                createMutation.mutate()
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="listName">List Name</Label>
                <Input
                  id="listName"
                  placeholder="e.g., Newsletter Subscribers"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="listDesc">Description (optional)</Label>
                <Input
                  id="listDesc"
                  placeholder="Brief description of this list"
                  value={listDescription}
                  onChange={(e) => setListDescription(e.target.value)}
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
                Create List
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="p-4 text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md">
          Failed to load contact lists
        </div>
      ) : lists && lists.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => (
            <Card key={list.id} className="border-card-border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{list.name}</CardTitle>
                    {list.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {list.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive h-8 w-8"
                    onClick={() => {
                      if (
                        confirm(
                          "Delete this list? Contacts will not be deleted."
                        )
                      ) {
                        deleteMutation.mutate(list.id)
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {(list._count?.members ?? 0).toLocaleString()} members
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(list.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookUser className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium mb-2">No lists yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create a list to organize your contacts
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
