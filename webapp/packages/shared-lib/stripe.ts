import Stripe from 'stripe';
import { PRICING_TIERS_CLIENT } from './pricing-tiers-client';
import type { PricingRegion } from './regional-pricing';

// Stripe Product and Price IDs
// This file is for server-side usage only

// Regional price structure type
type RegionalPriceIds = {
  default: string;
  south_asia?: string;
  southeast_asia?: string;
  latin_america?: string;
  eastern_europe?: string;
  africa?: string;
};

type TierPriceIds = {
  monthly: RegionalPriceIds;
  yearly: RegionalPriceIds;
};

// Live environment constants
const STRIPE_LIVE = {
  products: {
    basic: 'prod_Tq9hA0NP6JDsKq',
    premium: 'prod_Tq9hDPcDlmg1Qf',
    business: 'prod_Tq9h0NT8Ay4mgB',
  },
  priceIds: {
    basic: {
      monthly: {
        default: 'price_1SsTOOJNCLXf3krj1Ff1KmvU', // $12.99/month
        south_asia: 'price_1SwdHIJNCLXf3krjTIEyr2iI', // $4.55/month (65% off)
        southeast_asia: 'price_1SwdHJJNCLXf3krjesSnu6Xk', // $5.46/month (58% off)
        latin_america: 'price_1SwdHLJNCLXf3krjDnG2mYCz', // $5.85/month (55% off)
        eastern_europe: 'price_1SwdHMJNCLXf3krj9yHEyQ0q', // $6.50/month (50% off)
        africa: 'price_1SwdHIJNCLXf3krjTIEyr2iI', // $4.55/month (65% off) - same as south_asia
      },
      yearly: {
        default: 'price_1SsTOPJNCLXf3krjU1o47tIx', // $79.99/year
        south_asia: 'price_1SwdHJJNCLXf3krj5NYu6wKS', // $28/year (65% off)
        southeast_asia: 'price_1SwdHKJNCLXf3krjyShQxsO4', // $33.60/year (58% off)
        latin_america: 'price_1SwdHMJNCLXf3krjzok5TBlq', // $36/year (55% off)
        eastern_europe: 'price_1SwdHNJNCLXf3krjS3DfpjnQ', // $40/year (50% off)
        africa: 'price_1SwdHJJNCLXf3krj5NYu6wKS', // $28/year (65% off) - same as south_asia
      },
    },
    premium: {
      monthly: {
        default: 'price_1SsTOPJNCLXf3krjrP5f67tb', // $49/month
      },
      yearly: {
        default: 'price_1SsTOPJNCLXf3krj3yBRJST0', // $470/year
      },
    },
    business: {
      monthly: {
        default: 'price_1SsTOQJNCLXf3krjGFgnRCs1', // $199/month
      },
      yearly: {
        default: 'price_1SsTOQJNCLXf3krjOazUcjYJ', // $1910/year
      },
    },
  } as Record<string, TierPriceIds>,
} as const;

// Test environment constants
const STRIPE_TEST = {
  products: {
    basic: 'prod_Tq9oC1V3WzCPJ2',
    premium: 'prod_Tq9ostYZC7s2dk',
    business: 'prod_Tq9osvy6sVNOLe',
  },
  priceIds: {
    basic: {
      monthly: {
        default: 'price_1SsTV4JNCLXf3krja0hg7zBZ', // $12.99/month
        south_asia: 'price_1SwdImJNCLXf3krj4JX0QViv', // $4.55/month (65% off)
        southeast_asia: 'price_1SwdInJNCLXf3krjDucPaeDe', // $5.46/month (58% off)
        latin_america: 'price_1SwdIrJNCLXf3krj8GsB4W3a', // $5.85/month (55% off)
        eastern_europe: 'price_1SwdIsJNCLXf3krj0BfkYObS', // $6.50/month (50% off)
        africa: 'price_1SwdImJNCLXf3krj4JX0QViv', // $4.55/month (65% off) - same as south_asia
      },
      yearly: {
        default: 'price_1SsTV5JNCLXf3krjvkSZsfwv', // $79.99/year
        south_asia: 'price_1SwdInJNCLXf3krj3cbiGMBl', // $28/year (65% off)
        southeast_asia: 'price_1SwdIoJNCLXf3krjeBerQ6lP', // $33.60/year (58% off)
        latin_america: 'price_1SwdIrJNCLXf3krjodL552xl', // $36/year (55% off)
        eastern_europe: 'price_1SwdIsJNCLXf3krjkcMEG5EW', // $40/year (50% off)
        africa: 'price_1SwdInJNCLXf3krj3cbiGMBl', // $28/year (65% off) - same as south_asia
      },
    },
    premium: {
      monthly: {
        default: 'price_1SsTV5JNCLXf3krjhuB86cAA', // $49/month
      },
      yearly: {
        default: 'price_1SsTV6JNCLXf3krjcGBv3HfJ', // $470/year
      },
    },
    business: {
      monthly: {
        default: 'price_1SsTV6JNCLXf3krjVfT5N07K', // $199/month
      },
      yearly: {
        default: 'price_1SsTV7JNCLXf3krjWWD1NLjl', // $1910/year
      },
    },
  } as Record<string, TierPriceIds>,
} as const;

// Detect if using test or live Stripe keys (server-side only)
function isTestMode(): boolean {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (secretKey) {
    return secretKey.startsWith('sk_test_');
  }

  // Default to test mode if no key is found (safer for development)
  return true;
}

// Get the appropriate Stripe configuration based on current environment
function getStripeConfig() {
  return isTestMode() ? STRIPE_TEST : STRIPE_LIVE;
}

// Get Stripe product IDs
export function getStripeProducts() {
  const config = getStripeConfig();
  return config.products;
}

// Get Stripe price IDs
export function getStripePriceIds() {
  const config = getStripeConfig();
  return config.priceIds;
}

// Get current Stripe mode (test or live)
export function getStripeMode() {
  return isTestMode() ? 'test' as const : 'live' as const;
}

// Server-side pricing tier configuration with injected price IDs
// Returns default price IDs (use getRegionalPriceId for regional pricing)
export function getPricingTiers() {
  const priceIds = getStripePriceIds();

  return {
    free: {
      ...PRICING_TIERS_CLIENT.free,
      stripePriceIdMonthly: null as string | null,
      stripePriceIdYearly: null as string | null,
    },
    basic: {
      ...PRICING_TIERS_CLIENT.basic,
      stripePriceIdMonthly: priceIds.basic.monthly.default,
      stripePriceIdYearly: priceIds.basic.yearly.default,
    },
    premium: {
      ...PRICING_TIERS_CLIENT.premium,
      stripePriceIdMonthly: priceIds.premium.monthly.default,
      stripePriceIdYearly: priceIds.premium.yearly.default,
    },
    business: {
      ...PRICING_TIERS_CLIENT.business,
      stripePriceIdMonthly: priceIds.business.monthly.default,
      stripePriceIdYearly: priceIds.business.yearly.default,
    },
  };
}

/**
 * Get regional price ID for a tier and billing period
 * Falls back to default price if regional price not configured
 */
export function getRegionalPriceId(
  tier: 'basic' | 'premium' | 'business',
  billingPeriod: 'monthly' | 'yearly',
  region: PricingRegion
): string {
  const priceIds = getStripePriceIds();
  const tierPrices = priceIds[tier];

  if (!tierPrices) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  const periodPrices = tierPrices[billingPeriod];

  // Try to get regional price, fall back to default
  if (region !== 'default') {
    const regionalPrice = periodPrices[region as keyof RegionalPriceIds];
    if (regionalPrice) {
      return regionalPrice;
    }
  }

  return periodPrices.default;
}

/**
 * Check if a regional price exists for a tier/period/region combination
 */
export function hasRegionalStripePrice(
  tier: 'basic' | 'premium' | 'business',
  billingPeriod: 'monthly' | 'yearly',
  region: PricingRegion
): boolean {
  if (region === 'default') return true;

  const priceIds = getStripePriceIds();
  const tierPrices = priceIds[tier];
  if (!tierPrices) return false;

  const periodPrices = tierPrices[billingPeriod];
  return !!periodPrices[region as keyof RegionalPriceIds];
}

export type SubscriptionTier = keyof ReturnType<typeof getPricingTiers>;

// Helper to get tier from Stripe Price ID (handles both monthly, yearly, and regional prices)
export function getTierFromPriceId(priceId: string): SubscriptionTier {
  const priceIds = getStripePriceIds();

  for (const tier of ['basic', 'premium', 'business'] as const) {
    const tierPrices = priceIds[tier];
    // Check all regional prices for monthly
    for (const monthlyPrice of Object.values(tierPrices.monthly)) {
      if (monthlyPrice === priceId) return tier;
    }
    // Check all regional prices for yearly
    for (const yearlyPrice of Object.values(tierPrices.yearly)) {
      if (yearlyPrice === priceId) return tier;
    }
  }

  return 'free';
}

// Helper to check if a price ID is for yearly billing (handles regional prices)
export function isYearlyPriceId(priceId: string): boolean {
  const priceIds = getStripePriceIds();

  for (const tier of ['basic', 'premium', 'business'] as const) {
    const tierPrices = priceIds[tier];
    for (const yearlyPrice of Object.values(tierPrices.yearly)) {
      if (yearlyPrice === priceId) return true;
    }
  }

  return false;
}

// Initialize Stripe client
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
});

// Helper to calculate credit reset date (first day of next month)
export function calculateCreditResetDate(): Date {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth;
}
