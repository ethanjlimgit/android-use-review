import { NextRequest, NextResponse } from 'next/server';
import { apiHandler, requireAuth } from '@/lib/api-helpers';
import { prisma } from '@droiduse/shared-lib/server';

export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      subscriptionTier: true,
      subscriptionStatus: true,
      cancelAtPeriodEnd: true,
      creditAllowance: true,
      creditsUsed: true,
      freeBonusCredits: true,
      creditResetDate: true,
      subscriptionEndDate: true,
      stripeCustomerId: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Calculate total available credits (bonus + remaining allowance)
  const freeBonusCredits = user.freeBonusCredits || 0;
  const remainingAllowance = (user.creditAllowance || 0) - (user.creditsUsed || 0);
  const totalAvailableCredits = freeBonusCredits + remainingAllowance;

  return NextResponse.json({
    tier: user.subscriptionTier || 'free',
    status: user.subscriptionStatus || 'inactive',
    cancelAtPeriodEnd: user.cancelAtPeriodEnd || false,
    creditAllowance: user.creditAllowance || 0,
    creditsUsed: user.creditsUsed || 0,
    freeBonusCredits: freeBonusCredits,
    totalAvailableCredits: totalAvailableCredits,
    creditResetDate: user.creditResetDate,
    currentPeriodEnd: user.subscriptionEndDate,
    hasStripeCustomer: !!user.stripeCustomerId,
  });
});
