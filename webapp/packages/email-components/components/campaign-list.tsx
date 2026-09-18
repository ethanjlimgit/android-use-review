"use client"

import type { Campaign, CampaignStatus } from "../types"

const STATUS_COLORS: Record<CampaignStatus, string> = {
  DRAFT: "bg-secondary text-secondary-foreground",
  SCHEDULED: "bg-blue-500/20 text-blue-400",
  SENDING: "bg-yellow-500/20 text-yellow-400",
  SENT: "bg-green-500/20 text-green-400",
  PAUSED: "bg-orange-500/20 text-orange-400",
  CANCELLED: "bg-red-500/20 text-red-400",
}

interface CampaignListProps {
  campaigns: Campaign[]
  onView?: (campaign: Campaign) => void
  onDuplicate?: (campaign: Campaign) => void
  onPause?: (campaign: Campaign) => void
  onCancel?: (campaign: Campaign) => void
}

export function CampaignList({ campaigns, onView, onDuplicate, onPause, onCancel }: CampaignListProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-3 text-sm font-medium">Campaign</th>
            <th className="text-left px-4 py-3 text-sm font-medium">Status</th>
            <th className="text-left px-4 py-3 text-sm font-medium">Recipients</th>
            <th className="text-left px-4 py-3 text-sm font-medium">Created</th>
            <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id} className="border-b hover:bg-muted/30">
              <td className="px-4 py-3">
                <div
                  className="font-medium cursor-pointer hover:underline"
                  onClick={() => onView?.(campaign)}
                >
                  {campaign.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {campaign.variants.length} variant{campaign.variants.length !== 1 ? "s" : ""}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[campaign.status]}`}>
                  {campaign.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">
                {(campaign._count?.recipients ?? 0).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {new Date(campaign.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-1">
                  {onDuplicate && (
                    <button
                      onClick={() => onDuplicate(campaign)}
                      className="px-2 py-1 text-xs rounded hover:bg-muted"
                    >
                      Duplicate
                    </button>
                  )}
                  {onPause && (campaign.status === "SENDING" || campaign.status === "SCHEDULED") && (
                    <button
                      onClick={() => onPause(campaign)}
                      className="px-2 py-1 text-xs rounded hover:bg-muted"
                    >
                      Pause
                    </button>
                  )}
                  {onCancel && campaign.status === "DRAFT" && (
                    <button
                      onClick={() => onCancel(campaign)}
                      className="px-2 py-1 text-xs rounded hover:bg-destructive/20 text-destructive"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {campaigns.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                No campaigns found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
