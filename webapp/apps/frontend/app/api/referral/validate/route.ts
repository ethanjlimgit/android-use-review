import { NextRequest, NextResponse } from 'next/server'
import { validateReferralCode } from '@droiduse/shared-lib/server'
import { apiHandler, validateBody } from '@/lib/api-helpers'
import { z } from 'zod'

const validateSchema = z.object({
  code: z.string().length(8, 'Referral code must be 8 characters')
})

/**
 * POST /api/referral/validate
 * Validates a referral code (no auth required)
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { code } = await validateBody(request, validateSchema)

  const result = await validateReferralCode(code)

  if (!result.valid) {
    return NextResponse.json(
      { valid: false, error: result.error },
      { status: 400 }
    )
  }

  return NextResponse.json({
    valid: true,
    referrerName: result.referrerName
  })
})
