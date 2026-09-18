# PostHog post-wizard report

The wizard has completed a deep integration of your Next.js project with PostHog analytics. The integration includes:

- **Client-side initialization** via `instrumentation-client.ts` for automatic pageview tracking, session replay, and exception capture
- **Server-side client** via `lib/posthog-server.ts` for backend event tracking
- **User identification** on sign-up and sign-in to link anonymous and authenticated sessions
- **Custom event tracking** for key business actions and conversion funnels
- **Error tracking** using `posthog.captureException()` for monitoring application errors
- **Environment variables** configured in `.env` with `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`

## Events Implemented

| Event Name | Description | File Path |
|------------|-------------|-----------|
| `user_signed_up` | User successfully created a new account via email/password signup form | `components/auth/signup-form.tsx` |
| `user_signed_in` | User successfully signed in via email/password credentials | `components/auth/signin-form.tsx` |
| `oauth_sign_in_initiated` | User clicked OAuth sign-in button (GitHub, Google, or X/Twitter) | `components/auth/signin-form.tsx` |
| `user_signed_out` | User clicked sign out from the navigation dropdown menu | `components/navigation.tsx` |
| `knowledge_submitted` | User successfully submitted a new knowledge entry (app knowledge or AI skill) | `components/pages/contribute.tsx` |
| `marketplace_searched` | User performed a search in the marketplace | `components/pages/marketplace.tsx` |
| `marketplace_filtered` | User applied filters (type, score range) in the marketplace | `components/pages/marketplace.tsx` |
| `knowledge_viewed` | User clicked to view details of a knowledge entry | `components/knowledge-card.tsx` |
| `device_added` | User successfully added a new Android device via pairing code | `components/pages/devices.tsx` |
| `instruction_sent` | User sent an instruction to a connected device | `components/pages/devices.tsx` |
| `cta_clicked` | User clicked a primary call-to-action button on the homepage | `components/pages/home.tsx` |
| `sign_in_failed` | User attempted to sign in but authentication failed | `components/auth/signin-form.tsx` |
| `sign_up_failed` | User attempted to sign up but account creation failed | `components/auth/signup-form.tsx` |

## Files Modified

- `instrumentation-client.ts` - Added PostHog client initialization
- `lib/posthog-server.ts` - Created server-side PostHog client (new file)
- `.env` - Added PostHog environment variables (new file)
- `components/auth/signup-form.tsx` - Added sign-up tracking and user identification
- `components/auth/signin-form.tsx` - Added sign-in tracking, OAuth tracking, and user identification
- `components/navigation.tsx` - Added sign-out tracking with posthog.reset()
- `components/pages/contribute.tsx` - Added knowledge submission tracking
- `components/pages/marketplace.tsx` - Added search and filter tracking
- `components/knowledge-card.tsx` - Added knowledge view tracking
- `components/pages/devices.tsx` - Added device and instruction tracking
- `components/pages/home.tsx` - Added CTA click tracking
- `app/global-error.tsx` - Added PostHog error tracking

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

### Dashboard
- [Analytics basics](https://us.posthog.com/project/274362/dashboard/947587) - Main dashboard with all key metrics

### Insights
- [Sign Up Funnel](https://us.posthog.com/project/274362/insights/IVKMFSxI) - Conversion from sign-up page view to successful registration
- [Daily Sign Ups & Sign Ins](https://us.posthog.com/project/274362/insights/xWHzZXKY) - Daily trends of authentication events
- [Knowledge Contribution Funnel](https://us.posthog.com/project/274362/insights/RJn2GtvS) - Conversion from contribute page to knowledge submission
- [Device Onboarding Funnel](https://us.posthog.com/project/274362/insights/LLlboZOi) - Conversion from devices page to device addition
- [CTA Engagement](https://us.posthog.com/project/274362/insights/4U0Sh8tn) - Breakdown of homepage CTA clicks by button type
