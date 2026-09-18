'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@droiduse/shared-ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@droiduse/shared-ui/card';
import { Badge } from '@droiduse/shared-ui/badge';
import { Switch } from '@droiduse/shared-ui/switch';
import { Label } from '@droiduse/shared-ui/label';
import { Check, Sparkles, MapPin } from 'lucide-react';
import { PRICING_TIERS_CLIENT, type PricingRegion } from '@droiduse/shared-lib';
import { useSubscription } from '@/hooks/use-subscription';

interface RegionalPricingData {
  countryCode: string | null;
  countryName: string | null;
  region: PricingRegion;
  regionName: string | null;
  discountPercentage: number;
  hasDiscount: boolean;
  prices: {
    basic: {
      monthly: { original: number; discounted: number };
      yearly: { original: number; discounted: number };
    };
    premium: {
      monthly: { original: number; discounted: number };
      yearly: { original: number; discounted: number };
    };
    business: {
      monthly: { original: number; discounted: number };
      yearly: { original: number; discounted: number };
    };
  };
}

const PLAN_DESCRIPTIONS = {
  basic: 'Perfect for getting started with AI automation',
  premium: 'Advanced features for power users',
  business: 'Enterprise-grade automation at scale',
};

export function PricingCards() {
  const router = useRouter();
  const { data: session } = useSession();
  const { subscription, isLoading: isLoadingSubscription } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [regionalPricing, setRegionalPricing] = useState<RegionalPricingData | null>(null);
  const [isLoadingPricing, setIsLoadingPricing] = useState(true);

  // Fetch regional pricing on mount
  useEffect(() => {
    async function fetchRegionalPricing() {
      try {
        const response = await fetch('/api/pricing/regional');
        if (response.ok) {
          const data = await response.json();
          setRegionalPricing(data);
        }
      } catch (error) {
        console.error('Failed to fetch regional pricing:', error);
      } finally {
        setIsLoadingPricing(false);
      }
    }
    fetchRegionalPricing();
  }, []);

  // Tier hierarchy for comparison
  const tierHierarchy = { free: 0, basic: 1, premium: 2, business: 3 };
  const currentTierLevel = subscription?.tier ? tierHierarchy[subscription.tier as keyof typeof tierHierarchy] : 0;

  const handleSubscribe = async (tier: string, billingPeriod: 'monthly' | 'yearly') => {
    if (!session) {
      router.push('/auth/signin?redirect=/pricing');
      return;
    }

    setLoading(tier);

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          billingPeriod,
          countryCode: regionalPricing?.countryCode || undefined,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'No checkout URL returned');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setLoading(null);
    }
  };

  // Helper to get regional price for a tier
  const getRegionalPrice = (tier: 'basic' | 'premium' | 'business', period: 'monthly' | 'yearly') => {
    if (!regionalPricing?.hasDiscount) return null;
    return regionalPricing.prices[tier]?.[period];
  };

  // Filter out 'free' tier and convert to array
  const paidPlans = Object.entries(PRICING_TIERS_CLIENT)
    // Only show the basic plan
    .filter(([key]) => key === 'basic')
    // Show all paid plans
    // .filter(([key]) => key !== 'free')
    .map(([key, config]) => ({
      tier: key,
      ...config,
      description: PLAN_DESCRIPTIONS[key as keyof typeof PLAN_DESCRIPTIONS],
    }));

  return (
    <div className="space-y-12">
      {/* Regional Pricing Banner */}
      {regionalPricing?.hasDiscount && (
        <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg py-2 px-4 max-w-md mx-auto">
          <MapPin className="h-4 w-4" />
          <span>
            {regionalPricing.discountPercentage}% regional discount applied
            {regionalPricing.countryName && ` for ${regionalPricing.countryName}`}
          </span>
        </div>
      )}

      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-4">
        <Label htmlFor="billing-toggle" className={!isYearly ? 'font-semibold' : 'text-muted-foreground'}>
          Monthly
        </Label>
        <Switch
          id="billing-toggle"
          checked={isYearly}
          onCheckedChange={setIsYearly}
        />
        <Label htmlFor="billing-toggle" className={isYearly ? 'font-semibold' : 'text-muted-foreground'}>
          Yearly
        </Label>
      </div>
      {/* Pricing Cards Grid */}
      {/* Single plan layout - centered */}
      <div className="grid gap-8 lg:grid-cols-1 max-w-md mx-auto">
      {/* Multiple plans layout */}
      {/* <div className="grid gap-8 lg:grid-cols-3"> */}
        {paidPlans.map((plan) => {
          const billingPeriod = isYearly ? 'yearly' : 'monthly';
          const regionalPrice = getRegionalPrice(plan.tier as 'basic' | 'premium' | 'business', billingPeriod);

          // Calculate display prices (per month)
          const originalPrice = isYearly
            ? Math.round(plan.yearlyPrice / 12)
            : plan.monthlyPrice;
          const discountedPrice = regionalPrice
            ? isYearly
              ? Math.round(regionalPrice.discounted / 12)
              : regionalPrice.discounted
            : originalPrice;
          const displayPrice = discountedPrice;

          // Determine button state based on subscription
          const planTierLevel = tierHierarchy[plan.tier as keyof typeof tierHierarchy];
          const isCurrentPlan = session && subscription?.tier === plan.tier && subscription?.status === 'active';
          const isUpgrade = session && subscription?.tier && currentTierLevel < planTierLevel;
          const isDowngrade = session && subscription?.tier && currentTierLevel > planTierLevel;

          let buttonText = 'Get Started';
          let buttonDisabled = loading === plan.tier || isLoadingSubscription;

          if (isCurrentPlan) {
            buttonText = 'Current Plan';
            buttonDisabled = true;
          } else if (isUpgrade) {
            buttonText = 'Upgrade';
          } else if (isDowngrade) {
            buttonText = 'Downgrade';
          } else if (session && ((isYearly && plan.trialDaysYearly > 0) || (!isYearly && plan.trialDays > 0))) {
            buttonText = 'Start Free Trial';
          } else if (loading === plan.tier) {
            buttonText = 'Loading...';
          }

          return (
            <Card
              key={plan.tier}
              className={`relative ${
                plan.popular
                  ? 'border-primary shadow-lg scale-105'
                  : 'border-border'
              } ${isCurrentPlan ? 'ring-2 ring-primary' : ''}`}
            >
              {isCurrentPlan ? (
                <Badge
                  className="absolute -top-3 left-1/2 -translate-x-1/2"
                  variant="secondary"
                >
                  Current Plan
                </Badge>
              ) : plan.popular ? (
                <Badge
                  className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1"
                  variant="default"
                >
                  <Sparkles className="h-3 w-3" />
                  Most Popular
                </Badge>
              ) : null}

              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">${displayPrice.toFixed(2)}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>

                  {/* Show original price with strikethrough if there's a regional discount */}
                  {regionalPrice && originalPrice !== discountedPrice && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground line-through">
                        ${originalPrice.toFixed(2)}/month
                      </span>
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        Save {regionalPricing?.discountPercentage}%
                      </Badge>
                    </div>
                  )}
                </div>

                {isYearly && (
                  <p className="text-sm text-muted-foreground">
                    Billed ${regionalPrice ? regionalPrice.discounted.toFixed(2) : plan.yearlyPrice}/year
                  </p>
                )}

                {isYearly && plan.trialDaysYearly > 0 && !isCurrentPlan && (
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                    Try free for {plan.trialDaysYearly} days
                  </p>
                )}
                {!isYearly && plan.trialDays > 0 && !isCurrentPlan && (
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                    Try free for {plan.trialDays} days
                  </p>
                )}

                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.popular && !isCurrentPlan ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => handleSubscribe(plan.tier, billingPeriod)}
                  disabled={buttonDisabled}
                >
                  {buttonText}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
