import { NextRequest, NextResponse } from 'next/server';
import { apiHandler, requireAuth, validateBody } from '@/lib/api-helpers';
import { stripe, getPricingTiers } from '@droiduse/shared-lib/server';
import { prisma } from '@droiduse/shared-lib/server';
import { z } from 'zod';
import Stripe from 'stripe';

// Payment Intent request schema for mobile apps
const paymentIntentSchema = z.object({
  tier: z.enum(['basic', 'premium', 'business']),
  billingPeriod: z.enum(['monthly', 'yearly']),
});

export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request);
  const { tier, billingPeriod } = await validateBody(request, paymentIntentSchema);

  try {
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.email) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    // 1. Get or create Stripe customer
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });

      customerId = customer.id;

      // Update user with Stripe customer ID
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // 2. Determine price ID based on tier and billing period
    const pricingTiers = getPricingTiers();
    const tierConfig = pricingTiers[tier];
    const isYearly = billingPeriod === 'yearly';
    const priceId = isYearly
      ? tierConfig.stripePriceIdYearly
      : tierConfig.stripePriceIdMonthly;

    if (!priceId) {
      return NextResponse.json(
        { error: `Price ID not configured for ${tier} ${billingPeriod}` },
        { status: 400 }
      );
    }

    // 3. Determine trial period
    const trialDays = isYearly
      ? (tierConfig.trialDaysYearly || tierConfig.trialDays || 0)
      : (tierConfig.trialDays || 0);

    // 4. Create subscription with automatic intent creation
    // Stripe automatically creates SetupIntent (for trials) or PaymentIntent (for non-trials)
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.confirmation_secret', 'pending_setup_intent'],
      metadata: {
        userId: user.id,
        tier,
        billingPeriod,
        creditAllowance: tierConfig.creditAllowance.toString(),
      },
    };

    // Add trial period if applicable
    if (trialDays > 0) {
      subscriptionParams.trial_period_days = trialDays;
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams);

    // 5. Extract client secret
    let clientSecret: string | null = null;

    // For trials: Use pending_setup_intent
    if (subscription.pending_setup_intent) {
      const setupIntentData = subscription.pending_setup_intent;
      if (typeof setupIntentData === 'string') {
        const retrievedSetupIntent = await stripe.setupIntents.retrieve(setupIntentData);
        clientSecret = retrievedSetupIntent.client_secret;
      } else if (typeof setupIntentData === 'object') {
        clientSecret = (setupIntentData as Stripe.SetupIntent).client_secret;
      }
    }
    // For non-trials: Use confirmation_secret from latest invoice
    else {
      const invoice = subscription.latest_invoice as Stripe.Invoice & {
        confirmation_secret?: {
          client_secret: string;
        };
      };
      clientSecret = invoice?.confirmation_secret?.client_secret || null;
    }

    if (!clientSecret) {
      return NextResponse.json(
        { error: 'Failed to create payment or setup intent' },
        { status: 500 }
      );
    }

    // 6. Return all required data for mobile app
    return NextResponse.json({
      success: true,
      clientSecret: clientSecret,
      customer: customerId,
      subscriptionId: subscription.id,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      error: null,
    });

  } catch (error) {
    console.error('[payment-intent] Error creating payment intent:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create payment intent';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
});
