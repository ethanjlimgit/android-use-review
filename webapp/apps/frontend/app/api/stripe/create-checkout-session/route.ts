import { NextRequest, NextResponse } from 'next/server';
import { apiHandler, requireAuth, validateBody } from '@/lib/api-helpers';
import { stripe, getPricingTiers, getRegionalPriceId } from '@droiduse/shared-lib/server';
import { prisma } from '@droiduse/shared-lib/server';
import { createCheckoutSessionSchema, getRegionFromCountry } from '@droiduse/shared-lib';

export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request);
  const { tier, billingPeriod, countryCode } = await validateBody(request, createCheckoutSessionSchema);

  // Get user from database to check for existing Stripe customer
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get or create Stripe customer
  let customerId = user.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email || undefined,
      metadata: {
        userId: session.user.id,
      },
    });

    customerId = customer.id;

    // Update user with Stripe customer ID
    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  // Get tier config and derive price ID from tier, billing period, and region
  const pricingTiers = getPricingTiers();
  const tierConfig = pricingTiers[tier];
  const isYearly = billingPeriod === 'yearly';

  // Determine region from country code for regional pricing
  const region = getRegionFromCountry(countryCode);

  // Get regional price ID (falls back to default if regional price not configured)
  const priceId = getRegionalPriceId(tier, billingPeriod, region);

  if (!priceId) {
    return NextResponse.json(
      { error: `Price ID not configured for ${tier} ${billingPeriod}` },
      { status: 400 }
    );
  }

  // Dynamically determine base URL from request origin or fallback to env var
  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Determine trial period: use trialDaysYearly for yearly, trialDays for monthly
  const trialDays = isYearly
    ? (tierConfig.trialDaysYearly || tierConfig.trialDays || 0)
    : (tierConfig.trialDays || 0);

  // Create Checkout Session with trial period if applicable
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${origin}/dashboard?subscription=success`,
    cancel_url: `${origin}/pricing?canceled=true`,
    metadata: {
      userId: session.user.id,
      tier,
      countryCode: countryCode || '',
      region,
    },
    subscription_data: {
      metadata: {
        userId: session.user.id,
        tier,
        creditAllowance: tierConfig.creditAllowance.toString(),
        countryCode: countryCode || '',
        region,
      },
      // Add free trial period if applicable
      ...(trialDays > 0 && {
        trial_period_days: trialDays,
      }),
    },
    allow_promotion_codes: true,
  });

  return NextResponse.json({
    sessionId: checkoutSession.id,
    url: checkoutSession.url
  });
});
