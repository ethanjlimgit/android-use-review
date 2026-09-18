import { z } from "zod"

// ─── Segment Filters ────────────────────────────────────────────────

export const segmentFilterSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(["equals", "not_equals", "in", "not_in", "contains", "gt", "lt", "gte", "lte"]),
  value: z.unknown(),
})

export type SegmentFilter = z.infer<typeof segmentFilterSchema>

// ─── Projects ───────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
})

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
})

// ─── API Keys ───────────────────────────────────────────────────────

export const createApiKeySchema = z.object({
  name: z.string().optional(),
  scopes: z.array(z.string()).default(["*"]),
  expiresAt: z.coerce.date().nullable().optional(),
})

// ─── Senders ────────────────────────────────────────────────────────

export const createSenderSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  replyTo: z.string().email().nullable().optional(),
  isDefault: z.boolean().optional(),
  address: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1).default("US"),
})

export const updateSenderSchema = createSenderSchema.partial()

// ─── Contacts ───────────────────────────────────────────────────────

export const createContactSchema = z.object({
  email: z.string().email(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  externalId: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  source: z.string().nullable().optional(),
})

export const updateContactSchema = createContactSchema.partial()

export const importContactsSchema = z.object({
  columnMapping: z.record(z.string(), z.string()),
})

// ─── Contact Lists ──────────────────────────────────────────────────

export const createContactListSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
})

export const updateContactListSchema = createContactListSchema.partial()

export const addListMembersSchema = z.object({
  contactIds: z.array(z.string()).min(1),
})

// ─── Segments ───────────────────────────────────────────────────────

export const createSegmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  filters: z.array(segmentFilterSchema).min(1),
})

export const updateSegmentSchema = createSegmentSchema.partial()

// ─── Campaigns ──────────────────────────────────────────────────────

export const createCampaignVariantSchema = z.object({
  segmentId: z.string().nullable().optional(),
  subject: z.string().min(1),
  preheader: z.string().nullable().optional(),
  htmlBody: z.string().min(1),
  textBody: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export const createCampaignSchema = z.object({
  name: z.string().min(1),
  senderId: z.string().nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  sendByTimezone: z.boolean().optional(),
  targetHour: z.number().int().min(0).max(23).nullable().optional(),
  variants: z.array(createCampaignVariantSchema).min(1),
})

export const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  senderId: z.string().nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  sendByTimezone: z.boolean().optional(),
  targetHour: z.number().int().min(0).max(23).nullable().optional(),
  variants: z.array(createCampaignVariantSchema.extend({ id: z.string().optional() })).optional(),
})

export const sendTestEmailSchema = z.object({
  email: z.string().email(),
  variantIndex: z.number().int().min(0).optional(),
})

// ─── Admin Auth ─────────────────────────────────────────────────────

export const registerAdminSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6),
})

export const loginAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
