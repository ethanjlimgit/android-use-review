import { NextRequest, NextResponse } from 'next/server';
import { apiHandler, requireAuth } from '@/lib/api-helpers';
import { prisma, stripe } from '@droiduse/shared-lib/server';

export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      stripeSubscriptionId: true,
      cancelAtPeriodEnd: true,
      subscriptionTier: true,
    },
  });

  if (!user?.stripeSubscriptionId) {
    return NextResponse.json(
      { error: 'No active subscription found' },
      { status: 400 }
    );
  }

  if (!user.cancelAtPeriodEnd) {
    return NextResponse.json(
      { error: 'Subscription is not scheduled for cancellation' },
      { status: 400 }
    );
  }

  try {
    // Reactivate the subscription by removing the cancellation
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    // Update the database immediately
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        cancelAtPeriodEnd: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription reactivated successfully. Your subscription will continue as normal.',
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to reactivate subscription' },
      { status: 500 }
    );
  }
});
