// Client-safe pricing tier configuration (without server-only fields like stripePriceId)
// Credits: 1 credit = 1 second of standard agent work
export const PRICING_TIERS_CLIENT = {
  free: {
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    creditAllowance: 600, // 600 credits/month (10 minutes of agent work)
    features: ['Basic marketplace access', 'View knowledge entries', '600 credits/month'],
    trialDays: 0,
    trialDaysYearly: 0,
    popular: false,
  },
  basic: {
    name: 'Basic',
    monthlyPrice: 12.99,
    yearlyPrice: 79.99,
    creditAllowance: 7200, // 7,200 credits/month (2 hours of agent work)
    features: [
      'Smartest AI reasoning',
      '7,200 credits/month (2 hours of agent work)',
      'Automate daily tasks',
      'Connects to all your apps',
      'VIP priority speed',
    ],
    trialDays: 0,
    trialDaysYearly: 5,
    popular: true,
  },
  premium: {
    name: 'Premium',
    monthlyPrice: 49,
    yearlyPrice: 470,
    creditAllowance: 36000, // 36,000 credits/month (10 hours of agent work)
    features: [
      '7-day free trial',
      '36,000 credits/month (10 hours of agent work)',
      'Premium knowledge entries access',
      'Priority device access',
      'Advanced analytics',
      'Email support',
    ],
    trialDays: 7,
    trialDaysYearly: 7,
    popular: false,
  },
  business: {
    name: 'Business',
    monthlyPrice: 199,
    yearlyPrice: 1910,
    creditAllowance: 180000, // 180,000 credits/month (50 hours of agent work)
    features: [
      '180,000 credits/month (50 hours of agent work)',
      'Premium knowledge entries',
      'Business data integration',
      'Custom workflows',
      'Priority support',
      'SLA guarantee',
    ],
    trialDays: 0,
    trialDaysYearly: 0,
    popular: false,
  },
};
