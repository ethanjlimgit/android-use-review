// Re-export Prisma types and custom types for frontend use
import type {
  User,
  App,
  Skill,
  Device,
  Task,
  TaskStep,
} from '@droiduse/shared-prisma/generated/client'
import type {
  SkillWithApp,
  SkillWithAppAndAuthor,
  SkillLikeStatus,
  SkillSearchResult,
  SearchFilters,
  TaskWithSteps
} from './storage'

export type {
  User,
  App,
  Skill,
  Device,
  Task,
  TaskStep,
  SkillWithApp,
  SkillWithAppAndAuthor,
  SkillLikeStatus,
  SkillSearchResult,
  SearchFilters,
  TaskWithSteps,
}

// Subscription types
export type SubscriptionInfo = {
  tier: 'free' | 'basic' | 'premium' | 'business';
  status: 'inactive' | 'active' | 'canceled' | 'past_due' | 'trialing';
  creditAllowance: number;
  creditsUsed: number;
  freeBonusCredits: number;
  totalAvailableCredits: number;
  creditResetDate: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd?: boolean;
  hasStripeCustomer: boolean;
};

