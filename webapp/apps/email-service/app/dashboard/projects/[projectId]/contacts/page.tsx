"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Button } from "@droiduse/shared-ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Input } from "@droiduse/shared-ui/input"
import { Badge } from "@droiduse/shared-ui/badge"
import {
  ArrowLeft,
  Search,
  Upload,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
} from "lucide-react"

interface Contact {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  company: string | null
  jobTitle: string | null
  unsubscribed: boolean
  source: string | null
  createdAt: string
}

interface ContactsResponse {
  contacts: Contact[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function ContactsPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const pageSize = 25

  const { data, isLoading, error } = useQuery<ContactsResponse>({
    queryKey: ["contacts", projectId, page, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (searchQuery) params.set("search", searchQuery)
      const res = await fetch(
        `/api/internal/projects/${projectId}/contacts?${params}`
      )
      if (!res.ok) throw new Error("Failed to fetch contacts")
      return res.json()
    },
  })

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearchQuery(search)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/projects/${projectId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground text-sm">
            {data ? `${data.total.toLocaleString()} total contacts` : "Loading..."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/projects/${projectId}/contacts/lists`}>
            <Button variant="outline" size="sm">
              <Users className="h-4 w-4" />
              Lists
            </Button>
          </Link>
          <Link href={`/dashboard/projects/${projectId}/contacts/import`}>
            <Button size="sm">
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
          </Link>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <Card className="border-card-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-4 text-destructive-foreground bg-destructive/10 rounded-md m-4">
              Failed to load contacts
            </div>
          ) : data && data.contacts.length > 0 ? (
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
                      Company
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="border-b border-border last:border-0 hover:bg-muted/50"
                    >
                      <td className="p-4 text-sm font-mono">
                        {contact.email}
                      </td>
                      <td className="p-4 text-sm">
                        {[contact.firstName, contact.lastName]
                          .filter(Boolean)
                          .join(" ") || (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="p-4 text-sm">
                        {contact.company ? (
                          <div>
                            <span>{contact.company}</span>
                            {contact.jobTitle && (
                              <span className="text-muted-foreground block text-xs">{contact.jobTitle}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={
                            contact.unsubscribed ? "destructive" : "default"
                          }
                          className="text-xs"
                        >
                          {contact.unsubscribed
                            ? "Unsubscribed"
                            : "Subscribed"}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {contact.source || "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "No contacts match your search"
                  : "No contacts yet"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
