import { NextRequest, NextResponse } from 'next/server';
import { apiHandler, requireAuth } from '@/lib/api-helpers';
import { stripe } from '@droiduse/shared-lib/server';
import { prisma } from '@droiduse/shared-lib/server';

export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No Stripe customer found' },
      { status: 400 }
    );
  }

  // Dynamically determine base URL from request origin or fallback to env var
  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${origin}/dashboard`,
  });

  return NextResponse.json({ url: portalSession.url });
});
