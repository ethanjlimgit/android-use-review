import { NextRequest, NextResponse } from 'next/server';
import { stripe, getTierFromPriceId, calculateCreditResetDate, getPricingTiers } from '@droiduse/shared-lib/server';
import { prisma } from '@droiduse/shared-lib/server';
import Stripe from 'stripe';

// Configure route to handle raw body properly
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('[stripe webhook] No stripe-signature header provided');
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET is not set in environment variables');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    const error = err as Error;
    console.error('[stripe webhook] Signature verification failed:', error.message);
    console.error('[stripe webhook] Error details:', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  console.log('[stripe webhook] Event type:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[stripe webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[stripe webhook] Error processing event:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error('[stripe webhook] No userId in checkout session metadata');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  await updateUserSubscription(userId, subscription);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;

  if (!userId) {
    console.error('[stripe webhook] No userId in subscription metadata');
    return;
  }

  await updateUserSubscription(userId, subscription);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;

  if (!userId) {
    console.error('[stripe webhook] No userId in subscription metadata');
    return;
  }

  // When subscription is deleted, reset to free tier with free tier credits
  const pricingTiers = getPricingTiers();
  const freeTierCredits = pricingTiers.free.creditAllowance;

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeSubscriptionId: null,
      stripePriceId: null,
      subscriptionTier: 'free',
      subscriptionStatus: 'inactive',
      cancelAtPeriodEnd: false,
      creditAllowance: freeTierCredits,
      subscriptionEndDate: new Date(),
    },
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Reset credit usage on successful payment (new billing period)
  const invoiceWithSub = invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription };
  const subscriptionId = typeof invoiceWithSub.subscription === 'string'
    ? invoiceWithSub.subscription
    : invoiceWithSub.subscription?.id;

  if (!subscriptionId) {
    console.error('[stripe webhook] No subscription in invoice');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const userId = subscription.metadata.userId;
  if (!userId) return;

  const priceId = subscription.items.data[0]?.price.id;
  const tier = getTierFromPriceId(priceId);
  const pricingTiers = getPricingTiers();
  const tierConfig = pricingTiers[tier];

  await prisma.user.update({
    where: { id: userId },
    data: {
      creditsUsed: 0,
      creditResetDate: calculateCreditResetDate(),
      subscriptionStatus: 'active',
      creditAllowance: tierConfig.creditAllowance,
    },
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const invoiceWithSub = invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription };
  const subscriptionId = typeof invoiceWithSub.subscription === 'string'
    ? invoiceWithSub.subscription
    : invoiceWithSub.subscription?.id;

  if (!subscriptionId) {
    console.error('[stripe webhook] No subscription in invoice');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const userId = subscription.metadata.userId;
  if (!userId) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: 'past_due',
    },
  });
}

async function updateUserSubscription(userId: string, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id;
  const tier = getTierFromPriceId(priceId);
  const pricingTiers = getPricingTiers();
  const tierConfig = pricingTiers[tier];

  const status = subscription.status === 'active' ? 'active'
    : subscription.status === 'past_due' ? 'past_due'
    : subscription.status === 'trialing' ? 'trialing'
    : subscription.status === 'canceled' ? 'canceled'
    : 'inactive';

  // Extract period dates - Stripe returns these as numbers (Unix timestamps)
  const subWithPeriods = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };

  const currentPeriodStart = subWithPeriods.current_period_start
    ? new Date(subWithPeriods.current_period_start * 1000)
    : null;
  const currentPeriodEnd = subWithPeriods.current_period_end
    ? new Date(subWithPeriods.current_period_end * 1000)
    : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionTier: tier,
      subscriptionStatus: status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
      creditAllowance: tierConfig.creditAllowance,
      creditsUsed: 0, // Reset on subscription change
      creditResetDate: calculateCreditResetDate(),
      subscriptionStartDate: currentPeriodStart,
      subscriptionEndDate: currentPeriodEnd,
    },
  });
}
