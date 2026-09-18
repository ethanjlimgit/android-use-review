# Stripe Integration Complete

## Overview
Full Stripe subscription billing integration with custom UI has been implemented with 3 pricing tiers.

## Pricing Tiers

| Tier | Price/Month | Trial | Tokens | Features |
|------|-------------|-------|---------|----------|
| **Basic** | $20 | - | 100K | Basic knowledge entries, device management, community support |
| **Premium** | $49 | 14 days free | 300K | Premium knowledge access, priority device access, analytics, email support |
| **Business** | $199 | - | 2M | Premium knowledge, business data integration, custom workflows, priority support, SLA |

## What Was Implemented

### 1. Database Schema ✓
- Added subscription fields to User model in `packages/shared-prisma/prisma/schema.prisma`
- Fields: stripeCustomerId, stripeSubscriptionId, stripePriceId, subscriptionTier, subscriptionStatus, tokenAllowance, tokensUsed, tokenResetDate, subscriptionStartDate, subscriptionEndDate
- Run `pnpm db:push` to apply schema changes to your database

### 2. Shared Library ✓
- **`packages/shared-lib/stripe.ts`** - Stripe client, pricing configuration, helper functions
- **`packages/shared-lib/schemas.ts`** - Added createCheckoutSessionSchema
- **`packages/shared-lib/types.ts`** - Added SubscriptionInfo type
- **`packages/shared-lib/server.ts`** - Exports Stripe library

### 3. API Routes ✓
All routes in `apps/frontend/app/api/`:
- **`stripe/create-checkout-session/route.ts`** - Creates Stripe checkout sessions
- **`stripe/webhook/route.ts`** - Handles Stripe webhooks (critical!)
- **`stripe/create-portal-session/route.ts`** - Customer billing portal access
- **`subscription/route.ts`** - Get user subscription status

### 4. Pricing Page ✓
- **`apps/frontend/app/pricing/page.tsx`** - Main pricing page
- **`components/pricing/pricing-cards.tsx`** - 3-tier pricing cards with checkout
- **`components/pricing/pricing-comparison.tsx`** - Feature comparison table
- **`components/pricing/pricing-faq.tsx`** - FAQ accordion

### 5. Navigation ✓
- Updated `apps/frontend/components/navigation.tsx` with "Pricing" link

### 6. Dashboard Integration ✓
- **`components/dashboard/subscription-widget.tsx`** - Token usage display, upgrade CTA
- Shows current tier, token usage progress, reset date
- Manage subscription or upgrade buttons

### 7. Access Control ✓
- **`hooks/use-subscription.ts`** - Client-side subscription hook
- **`lib/subscription-helpers.ts`** - Server-side access control functions
  - `checkSubscriptionAccess()` - Verify tier access
  - `incrementTokenUsage()` - Track token consumption
  - `checkTokenAvailability()` - Check if tokens available

### 8. Session Extension ✓
- Extended NextAuth session with subscription fields
- Updated `apps/frontend/lib/auth.ts` and `packages/shared-lib/auth/jwt-callbacks.ts`

### 9. Environment Configuration ✓
- Created `.env.example` with all required Stripe variables

## Next Steps: Manual Configuration

### 1. Create Stripe Products
In your Stripe Dashboard (https://dashboard.stripe.com):

1. Go to **Products** → **Add Product**
2. Create 3 products:

**Basic Plan:**
- Name: "Basic Plan"
- Price: $20/month (recurring)
- Metadata:
  - `tier` = `basic`
  - `token_allowance` = `100000`

**Premium Plan:**
- Name: "Premium Plan"
- Price: $49/month (recurring)
- **Note:** Trial period is configured in the checkout session (14 days)
- Metadata:
  - `tier` = `premium`
  - `token_allowance` = `300000`

**Business Plan:**
- Name: "Business Plan"
- Price: $199/month (recurring)
- Metadata:
  - `tier` = `business`
  - `token_allowance` = `2000000`

3. Copy each **Price ID** (starts with `price_...`)
4. Update `packages/shared-lib/stripe.ts` with your Price IDs:
   - Replace `price_REPLACE_WITH_BASIC_PRICE_ID`
   - Replace `price_REPLACE_WITH_PREMIUM_PRICE_ID`
   - Replace `price_REPLACE_WITH_BUSINESS_PRICE_ID`

### 2. Configure Webhooks
1. Go to **Developers** → **Webhooks** → **Add endpoint**
2. Endpoint URL: `https://yourdomain.com/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the **Webhook signing secret** (starts with `whsec_...`)

### 3. Get API Keys
1. Go to **Developers** → **API keys**
2. Copy:
   - **Publishable key** (pk_test_... for test mode)
   - **Secret key** (sk_test_... for test mode)

### 4. Update Environment Variables
Add to your `.env` file:

```env
# Stripe API Keys
STRIPE_SECRET_KEY="sk_test_your_secret_key_here"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_your_publishable_key_here"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret_here"

# Application URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"  # or your production URL
```

**Note:** Price IDs are now configured in `packages/shared-lib/stripe.ts` (not environment variables)

### 5. Apply Database Changes
```bash
pnpm db:push
```

### 6. Restart Development Server
```bash
pnpm dev
```

## Testing Locally

### Test Stripe Webhooks Locally
Install Stripe CLI:
```bash
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Test Cards (Test Mode)
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **Requires Auth**: 4000 0025 0000 3155

## Usage

### For Users
1. Navigate to **/pricing**
2. Select a plan
3. Click "Get Started"
4. Complete Stripe checkout
5. View subscription in **/dashboard**
6. Manage subscription via "Manage Subscription" button

### For Developers

**Check if user can access premium features:**
```typescript
import { useSubscription } from '@/hooks/use-subscription';

function Component() {
  const { canAccessPremiumKnowledge, isNearTokenLimit } = useSubscription();

  if (!canAccessPremiumKnowledge) {
    return <UpgradePrompt />;
  }

  // Show premium content
}
```

**Server-side access control:**
```typescript
import { checkSubscriptionAccess, incrementTokenUsage } from '@/lib/subscription-helpers';

// Check tier access
const hasAccess = await checkSubscriptionAccess(userId, 'premium');

// Track token usage
const success = await incrementTokenUsage(userId, 1000);
if (!success) {
  return NextResponse.json({ error: 'Token limit exceeded' }, { status: 429 });
}
```

## Files Created

### Shared Libraries (5 files)
- `packages/shared-lib/stripe.ts`
- `packages/shared-lib/server.ts` (modified)
- `packages/shared-lib/schemas.ts` (modified)
- `packages/shared-lib/types.ts` (modified)
- `packages/shared-lib/auth/jwt-callbacks.ts` (modified)

### API Routes (4 files)
- `apps/frontend/app/api/stripe/create-checkout-session/route.ts`
- `apps/frontend/app/api/stripe/webhook/route.ts`
- `apps/frontend/app/api/stripe/create-portal-session/route.ts`
- `apps/frontend/app/api/subscription/route.ts`

### Pages & Components (8 files)
- `apps/frontend/app/pricing/page.tsx`
- `apps/frontend/components/pricing/pricing-cards.tsx`
- `apps/frontend/components/pricing/pricing-comparison.tsx`
- `apps/frontend/components/pricing/pricing-faq.tsx`
- `apps/frontend/components/dashboard/subscription-widget.tsx`
- `apps/frontend/hooks/use-subscription.ts`
- `apps/frontend/lib/subscription-helpers.ts`
- `apps/frontend/lib/auth.ts` (modified)
- `apps/frontend/components/navigation.tsx` (modified)

### Configuration (2 files)
- `.env.example`
- `packages/shared-prisma/prisma/schema.prisma` (modified)

## Important Notes

- **Price IDs are hardcoded** - Update `packages/shared-lib/stripe.ts` with your Stripe Price IDs
- **Premium has 14-day free trial** - Automatically applied during checkout
- **Webhook handler is critical** - All subscription changes sync through webhooks
- **Test mode first** - Use Stripe test keys before going live
- **Token tracking** - Implement token consumption in your AI/API endpoints
- **Custom UI** - Uses custom checkout flow (not Stripe hosted pages)
- **Customer Portal** - Uses Stripe's customer portal for subscription management

## Support

For issues or questions:
1. Check Stripe webhook logs in Dashboard
2. Check Next.js console for `[stripe webhook]` logs
3. Verify environment variables are set correctly
4. Test with Stripe CLI for local development
