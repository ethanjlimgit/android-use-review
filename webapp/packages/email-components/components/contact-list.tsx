"use client"

import type { Contact } from "../types"

interface ContactListProps {
  contacts: Contact[]
  total?: number
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  onEdit?: (contact: Contact) => void
  onDelete?: (contact: Contact) => void
}

export function ContactList({
  contacts,
  total = 0,
  page = 1,
  pageSize = 25,
  onPageChange,
  onEdit,
  onDelete,
}: ContactListProps) {
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 text-sm font-medium">Email</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Source</th>
              <th className="text-left px-4 py-3 text-sm font-medium">Status</th>
              <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id} className="border-b hover:bg-muted/30">
                <td className="px-4 py-3 text-sm font-medium">{contact.email}</td>
                <td className="px-4 py-3 text-sm">
                  {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {contact.source || "-"}
                </td>
                <td className="px-4 py-3">
                  {contact.emailUnsubscribed ? (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                      Unsubscribed
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                      Subscribed
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(contact)}
                        className="px-2 py-1 text-xs rounded hover:bg-muted"
                      >
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(contact)}
                        className="px-2 py-1 text-xs rounded hover:bg-destructive/20 text-destructive"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No contacts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-muted"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-muted"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
