import { NextRequest, NextResponse } from 'next/server';
import { apiHandler, requireAuth } from '@/lib/api-helpers';
import { prisma, stripe } from '@droiduse/shared-lib/server';

export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      stripeSubscriptionId: true,
      subscriptionTier: true,
    },
  });

  if (!user?.stripeSubscriptionId) {
    return NextResponse.json(
      { error: 'No active subscription found' },
      { status: 400 }
    );
  }

  if (user.subscriptionTier === 'free') {
    return NextResponse.json(
      { error: 'Free tier cannot be canceled' },
      { status: 400 }
    );
  }

  try {
    // Cancel the subscription at period end (customer retains access until billing period ends)
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Update the database immediately to reflect the cancellation
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        cancelAtPeriodEnd: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription canceled successfully. You will retain access until the end of your billing period.',
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
});
