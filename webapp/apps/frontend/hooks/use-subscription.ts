'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import type { SubscriptionInfo } from '@droiduse/shared-lib';

export function useSubscription() {
  const { status } = useSession();

  const { data: subscription, isLoading, error } = useQuery<SubscriptionInfo>({
    queryKey: ['/api/subscription'],
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: status === 'authenticated', // Only fetch if user is logged in
  });

  const canAccessPremiumKnowledge = subscription?.tier === 'premium' || subscription?.tier === 'business';
  const canAccessBusinessFeatures = subscription?.tier === 'business';
  const hasActiveSubscription = subscription?.status === 'active';

  // Calculate total available and usage percentage
  const totalCredits = subscription
    ? (subscription.creditAllowance + (subscription.freeBonusCredits || 0))
    : 0;
  const totalAvailable = subscription?.totalAvailableCredits ?? 0;
  const isNearCreditLimit = totalCredits > 0
    ? (totalAvailable / totalCredits) < 0.2  // Less than 20% remaining
    : false;

  return {
    subscription,
    isLoading,
    error,
    canAccessPremiumKnowledge,
    canAccessBusinessFeatures,
    hasActiveSubscription,
    isNearCreditLimit,
    totalAvailable,
    totalCredits,
  };
}
