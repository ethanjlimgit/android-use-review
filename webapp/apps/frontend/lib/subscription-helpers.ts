import { prisma } from '@droiduse/shared-lib/server';
import { PRICING_TIERS_CLIENT } from '@droiduse/shared-lib';

type SubscriptionTier = 'free' | 'basic' | 'premium' | 'business';

export async function checkSubscriptionAccess(
  userId: string,
  requiredTier: 'basic' | 'premium' | 'business'
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true, subscriptionStatus: true },
  });

  if (!user || user.subscriptionStatus !== 'active') {
    return false;
  }

  const tierHierarchy = { free: 0, basic: 1, premium: 2, business: 3 };
  const userTierLevel = tierHierarchy[user.subscriptionTier as keyof typeof tierHierarchy] || 0;
  const requiredTierLevel = tierHierarchy[requiredTier];

  return userTierLevel >= requiredTierLevel;
}

/**
 * Increment credit usage for a user.
 * Credits are consumed when tasks are executed (1 credit = 1 second of agent work).
 * Uses freeBonusCredits first before consuming from regular credit allowance.
 * @returns true if credits were successfully consumed, false if limit exceeded
 */
export async function incrementCreditUsage(userId: string, credits: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditAllowance: true, creditsUsed: true, freeBonusCredits: true },
  });

  if (!user) return false;

  // Calculate total available credits (bonus + remaining allowance)
  const remainingAllowance = user.creditAllowance - user.creditsUsed;
  const totalAvailable = user.freeBonusCredits + remainingAllowance;

  if (credits > totalAvailable) {
    return false; // Exceeded limit
  }

  // Use freeBonusCredits first, then creditsUsed
  let bonusToDeduct = 0;
  let regularToAdd = 0;

  if (user.freeBonusCredits >= credits) {
    // All credits can be covered by bonus credits
    bonusToDeduct = credits;
  } else {
    // Use all bonus credits first, then regular
    bonusToDeduct = user.freeBonusCredits;
    regularToAdd = credits - bonusToDeduct;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      freeBonusCredits: { decrement: bonusToDeduct },
      creditsUsed: { increment: regularToAdd },
    },
  });

  return true;
}

/**
 * Check if user has enough credits available.
 * Includes freeBonusCredits in the total available credits.
 * @returns true if user has enough credits, false otherwise
 */
export async function checkCreditAvailability(userId: string, requiredCredits: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditAllowance: true, creditsUsed: true, freeBonusCredits: true },
  });

  if (!user) return false;

  // Total available = bonus credits + remaining allowance
  const remainingAllowance = user.creditAllowance - user.creditsUsed;
  const totalAvailable = user.freeBonusCredits + remainingAllowance;

  return requiredCredits <= totalAvailable;
}

/**
 * Update credit allowance when subscription tier changes.
 * On upgrade: immediately grants new tier's credit allowance
 * On downgrade: keeps current allowance until next billing period (handled by webhook)
 * @returns the updated credit allowance
 */
export async function updateCreditAllowanceForTier(
  userId: string,
  newTier: SubscriptionTier,
  resetCreditsUsed: boolean = false
): Promise<number> {
  const tierConfig = PRICING_TIERS_CLIENT[newTier];
  const newAllowance = tierConfig.creditAllowance;

  const updateData: { creditAllowance: number; creditsUsed?: number } = {
    creditAllowance: newAllowance,
  };

  if (resetCreditsUsed) {
    updateData.creditsUsed = 0;
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  return newAllowance;
}

/**
 * Get credit allowance for a subscription tier.
 */
export function getCreditAllowanceForTier(tier: SubscriptionTier): number {
  return PRICING_TIERS_CLIENT[tier].creditAllowance;
}

/**
 * Migrate existing users with 0 credit allowance to free tier credits.
 * This is a one-time migration for existing users created before credit system.
 * @returns number of users updated
 */
export async function migrateExistingUserCredits(): Promise<number> {
  const freeTierCredits = PRICING_TIERS_CLIENT.free.creditAllowance;

  const result = await prisma.user.updateMany({
    where: {
      creditAllowance: 0,
    },
    data: {
      creditAllowance: freeTierCredits,
      subscriptionTier: 'free',
    },
  });

  return result.count;
}
