import { z } from "zod"

// ─── Shared Types ───────────────────────────────────────────────────

export interface EmailApiClientConfig {
  baseUrl: string
  apiKey: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ─── Contact Types ──────────────────────────────────────────────────

export interface Contact {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  externalId: string | null
  phone: string | null
  timezone: string | null
  country: string | null
  city: string | null
  metadata: Record<string, unknown> | null
  emailUnsubscribed: boolean
  source: string | null
  createdAt: string
  updatedAt: string
}

export interface ContactList {
  id: string
  name: string
  description: string | null
  createdAt: string
  _count?: { memberships: number }
}

export interface ContactImportJob {
  id: string
  source: "CSV" | "API" | "DATABASE_SYNC"
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
  totalRows: number
  processedRows: number
  errors: unknown[]
  columnMapping: Record<string, string> | null
  createdAt: string
}

// ─── Segment Types ──────────────────────────────────────────────────

export const segmentFilterSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(["equals", "not_equals", "in", "not_in", "contains", "gt", "lt", "gte", "lte"]),
  value: z.unknown(),
})

export type SegmentFilter = z.infer<typeof segmentFilterSchema>

export interface EmailSegment {
  id: string
  name: string
  description: string | null
  filters: SegmentFilter[]
  createdAt: string
}

export interface SegmentPreview {
  count: number
  sample: Array<{ id: string; email: string; firstName: string | null; lastName: string | null }>
}

// ─── Campaign Types ─────────────────────────────────────────────────

export type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "PAUSED" | "CANCELLED"

export interface CampaignVariant {
  id: string
  segmentId: string | null
  subject: string
  preheader: string | null
  htmlBody: string
  textBody: string | null
  sortOrder: number
  segment?: { id: string; name: string } | null
}

export interface Campaign {
  id: string
  name: string
  status: CampaignStatus
  scheduledAt: string | null
  sendByTimezone: boolean
  targetHour: number | null
  senderId: string | null
  createdAt: string
  variants: CampaignVariant[]
  _count?: { recipients: number }
  createdBy?: { name: string | null; email: string } | null
}

export interface CampaignStats {
  totalRecipients: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  spamReports: number
  openRate: number
  clickRate: number
  bounceRate: number
  variantStats: Array<{
    variantId: string
    subject: string
    segmentName: string
    recipientCount: number
    events: Record<string, number>
  }>
  eventsOverTime: Array<{ date: string; eventType: string; count: number }>
}

export interface CampaignRecipient {
  id: string
  email: string
  status: string
  sentAt: string | null
  timezone: string | null
  contact: { firstName: string | null; lastName: string | null; email: string }
  variant: { subject: string }
  events: Array<{ eventType: string; timestamp: string }>
}

// ─── Sender Types ───────────────────────────────────────────────────

export interface SenderIdentity {
  id: string
  name: string
  email: string
  replyTo: string | null
  isDefault: boolean
  verified: boolean
  createdAt: string
}
