// Components
export { SegmentBuilder } from "./components/segment-builder"
export { EmailPreview } from "./components/email-preview"
export { CampaignList } from "./components/campaign-list"
export { ContactList } from "./components/contact-list"

// Hooks
export {
  createEmailApiClient,
  useContacts,
  useContactLists,
  useSegments,
  useSegmentPreview,
  useCampaigns,
  useCampaign,
  useCampaignStats,
  useCampaignRecipients,
  useSenders,
  useCreateContact,
  useCreateSegment,
  useCreateCampaign,
  useSendCampaign,
} from "./hooks"
export type { EmailApiClient } from "./hooks"

// Types
export type {
  EmailApiClientConfig,
  PaginatedResponse,
  Contact,
  ContactList as ContactListType,
  ContactImportJob,
  SegmentFilter,
  EmailSegment,
  Campaign,
  CampaignVariant,
  CampaignStatus,
  CampaignStats,
  CampaignRecipient,
  SenderIdentity,
} from "./types"
export { segmentFilterSchema } from "./types"
