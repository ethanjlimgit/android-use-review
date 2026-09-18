import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  EmailApiClientConfig,
  Contact,
  ContactList,
  EmailSegment,
  Campaign,
  CampaignStats,
  CampaignRecipient,
  SenderIdentity,
  PaginatedResponse,
  SegmentPreview,
  ContactImportJob,
} from "./types"

// ─── API Client Factory ─────────────────────────────────────────────

export function createEmailApiClient(config: EmailApiClientConfig) {
  const headers = {
    "Content-Type": "application/json",
    "X-API-Key": config.apiKey,
  }

  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${config.baseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...options?.headers },
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Request failed" }))
      throw new Error(error.error || `HTTP ${res.status}`)
    }
    return res.json()
  }

  return {
    // Contacts
    getContacts: (params?: { page?: number; pageSize?: number; search?: string }) => {
      const qs = new URLSearchParams()
      if (params?.page) qs.set("page", String(params.page))
      if (params?.pageSize) qs.set("pageSize", String(params.pageSize))
      if (params?.search) qs.set("search", params.search)
      return request<PaginatedResponse<Contact>>(`/api/v1/contacts?${qs}`)
    },
    createContact: (data: Partial<Contact>) =>
      request<Contact>("/api/v1/contacts", { method: "POST", body: JSON.stringify(data) }),
    updateContact: (id: string, data: Partial<Contact>) =>
      request<Contact>(`/api/v1/contacts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteContact: (id: string) =>
      request<{ success: boolean }>(`/api/v1/contacts/${id}`, { method: "DELETE" }),
    importContacts: (data: { columnMapping: Record<string, string> }) =>
      request<ContactImportJob>("/api/v1/contacts/import", { method: "POST", body: JSON.stringify(data) }),
    getImportJob: (jobId: string) =>
      request<ContactImportJob>(`/api/v1/contacts/import/${jobId}`),

    // Contact Lists
    getContactLists: () => request<ContactList[]>("/api/v1/contacts/lists"),
    createContactList: (data: { name: string; description?: string }) =>
      request<ContactList>("/api/v1/contacts/lists", { method: "POST", body: JSON.stringify(data) }),
    deleteContactList: (id: string) =>
      request<{ success: boolean }>(`/api/v1/contacts/lists/${id}`, { method: "DELETE" }),
    addListMembers: (listId: string, contactIds: string[]) =>
      request<{ added: number }>(`/api/v1/contacts/lists/${listId}/members`, {
        method: "POST", body: JSON.stringify({ contactIds }),
      }),

    // Segments
    getSegments: () => request<EmailSegment[]>("/api/v1/segments"),
    createSegment: (data: { name: string; description?: string; filters: unknown[] }) =>
      request<EmailSegment>("/api/v1/segments", { method: "POST", body: JSON.stringify(data) }),
    updateSegment: (id: string, data: Partial<EmailSegment>) =>
      request<EmailSegment>(`/api/v1/segments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteSegment: (id: string) =>
      request<{ success: boolean }>(`/api/v1/segments/${id}`, { method: "DELETE" }),
    previewSegment: (id: string) =>
      request<SegmentPreview>(`/api/v1/segments/${id}/preview`),

    // Campaigns
    getCampaigns: (params?: { status?: string; search?: string }) => {
      const qs = new URLSearchParams()
      if (params?.status) qs.set("status", params.status)
      if (params?.search) qs.set("search", params.search)
      return request<Campaign[]>(`/api/v1/campaigns?${qs}`)
    },
    getCampaign: (id: string) => request<Campaign>(`/api/v1/campaigns/${id}`),
    createCampaign: (data: unknown) =>
      request<Campaign>("/api/v1/campaigns", { method: "POST", body: JSON.stringify(data) }),
    updateCampaign: (id: string, data: unknown) =>
      request<Campaign>(`/api/v1/campaigns/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteCampaign: (id: string) =>
      request<{ success: boolean }>(`/api/v1/campaigns/${id}`, { method: "DELETE" }),
    sendCampaign: (id: string) =>
      request<{ success: boolean; recipientCount: number }>(`/api/v1/campaigns/${id}/send`, { method: "POST" }),
    pauseCampaign: (id: string) =>
      request<{ success: boolean }>(`/api/v1/campaigns/${id}/pause`, { method: "POST" }),
    cancelCampaign: (id: string) =>
      request<{ success: boolean }>(`/api/v1/campaigns/${id}/cancel`, { method: "POST" }),
    duplicateCampaign: (id: string) =>
      request<Campaign>(`/api/v1/campaigns/${id}/duplicate`, { method: "POST" }),
    sendTestEmail: (id: string, data: { email: string; variantIndex?: number }) =>
      request<{ success: boolean }>(`/api/v1/campaigns/${id}/preview`, {
        method: "POST", body: JSON.stringify(data),
      }),
    getCampaignStats: (id: string) =>
      request<CampaignStats>(`/api/v1/campaigns/${id}/stats`),
    getCampaignRecipients: (id: string, params?: { page?: number; pageSize?: number; status?: string }) => {
      const qs = new URLSearchParams()
      if (params?.page) qs.set("page", String(params.page))
      if (params?.pageSize) qs.set("pageSize", String(params.pageSize))
      if (params?.status) qs.set("status", params.status)
      return request<PaginatedResponse<CampaignRecipient>>(`/api/v1/campaigns/${id}/recipients?${qs}`)
    },

    // Senders
    getSenders: () => request<SenderIdentity[]>("/api/v1/senders"),
    createSender: (data: { name: string; email: string; replyTo?: string; isDefault?: boolean }) =>
      request<SenderIdentity>("/api/v1/senders", { method: "POST", body: JSON.stringify(data) }),
    updateSender: (id: string, data: Partial<SenderIdentity>) =>
      request<SenderIdentity>(`/api/v1/senders/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteSender: (id: string) =>
      request<{ success: boolean }>(`/api/v1/senders/${id}`, { method: "DELETE" }),
  }
}

export type EmailApiClient = ReturnType<typeof createEmailApiClient>

// ─── React Query Hooks ──────────────────────────────────────────────

export function useContacts(client: EmailApiClient, params?: { page?: number; pageSize?: number; search?: string }) {
  return useQuery({
    queryKey: ["email-contacts", params],
    queryFn: () => client.getContacts(params),
  })
}

export function useContactLists(client: EmailApiClient) {
  return useQuery({
    queryKey: ["email-contact-lists"],
    queryFn: () => client.getContactLists(),
  })
}

export function useSegments(client: EmailApiClient) {
  return useQuery({
    queryKey: ["email-segments"],
    queryFn: () => client.getSegments(),
  })
}

export function useSegmentPreview(client: EmailApiClient, segmentId: string) {
  return useQuery({
    queryKey: ["email-segment-preview", segmentId],
    queryFn: () => client.previewSegment(segmentId),
    enabled: !!segmentId,
  })
}

export function useCampaigns(client: EmailApiClient, params?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ["email-campaigns", params],
    queryFn: () => client.getCampaigns(params),
  })
}

export function useCampaign(client: EmailApiClient, id: string) {
  return useQuery({
    queryKey: ["email-campaign", id],
    queryFn: () => client.getCampaign(id),
    enabled: !!id,
  })
}

export function useCampaignStats(client: EmailApiClient, id: string) {
  return useQuery({
    queryKey: ["email-campaign-stats", id],
    queryFn: () => client.getCampaignStats(id),
    enabled: !!id,
  })
}

export function useCampaignRecipients(
  client: EmailApiClient,
  id: string,
  params?: { page?: number; pageSize?: number; status?: string }
) {
  return useQuery({
    queryKey: ["email-campaign-recipients", id, params],
    queryFn: () => client.getCampaignRecipients(id, params),
    enabled: !!id,
  })
}

export function useSenders(client: EmailApiClient) {
  return useQuery({
    queryKey: ["email-senders"],
    queryFn: () => client.getSenders(),
  })
}

// ─── Mutation Hooks ─────────────────────────────────────────────────

export function useCreateContact(client: EmailApiClient) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Contact>) => client.createContact(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["email-contacts"] }),
  })
}

export function useCreateSegment(client: EmailApiClient) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string; filters: unknown[] }) =>
      client.createSegment(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["email-segments"] }),
  })
}

export function useCreateCampaign(client: EmailApiClient) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => client.createCampaign(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["email-campaigns"] }),
  })
}

export function useSendCampaign(client: EmailApiClient) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => client.sendCampaign(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["email-campaigns"] }),
  })
}
