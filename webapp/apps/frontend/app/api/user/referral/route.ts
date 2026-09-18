import { NextRequest, NextResponse } from 'next/server'
import { getUserReferralStats } from '@droiduse/shared-lib/server'
import { requireAuth, apiHandler } from '@/lib/api-helpers'

/**
 * GET /api/user/referral
 * Get the authenticated user's referral code and stats
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request)

  const stats = await getUserReferralStats(session.user.id)

  return NextResponse.json({
    success: true,
    ...stats
  })
})
