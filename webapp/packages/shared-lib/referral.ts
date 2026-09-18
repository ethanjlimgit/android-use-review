import crypto from 'crypto'
import { prisma } from './prisma'

// Constants
export const REFERRAL_BONUS_CREDITS = 300  // Both referrer and referee get this amount
export const MAX_REFERRALS_PER_USER = 50

// Types
export interface ReferralStats {
  referralCode: string
  referralCount: number
  totalCreditsEarned: number
  maxReferrals: number
  remainingReferrals: number
  referrals: Array<{
    id: string
    refereeEmail: string | null
    refereeName: string | null
    status: 'PENDING' | 'COMPLETED' | 'EXPIRED'
    bonusCredits: number
    createdAt: Date
    completedAt: Date | null
  }>
}

export interface ValidateReferralResult {
  valid: boolean
  referrerId?: string
  referrerName?: string | null
  error?: string
}

/**
 * Generates a unique 8-character alphanumeric referral code
 */
export function generateReferralCode(): string {
  // Use base62 (alphanumeric) characters for clean, URL-safe codes
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length]
  }
  return code
}

/**
 * Ensures a user has a referral code, generating one if necessary
 */
export async function ensureUserHasReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true }
  })

  if (user?.referralCode) {
    return user.referralCode
  }

  // Generate a unique code
  let code: string
  let attempts = 0
  const maxAttempts = 10

  do {
    code = generateReferralCode()
    const existing = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true }
    })
    if (!existing) break
    attempts++
  } while (attempts < maxAttempts)

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique referral code')
  }

  // Update user with new code
  await prisma.user.update({
    where: { id: userId },
    data: { referralCode: code }
  })

  return code
}

/**
 * Validates a referral code and returns the referrer info
 */
export async function validateReferralCode(code: string): Promise<ValidateReferralResult> {
  if (!code || code.length !== 8) {
    return { valid: false, error: 'Invalid referral code format' }
  }

  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: {
      id: true,
      name: true,
      referralCount: true
    }
  })

  if (!referrer) {
    return { valid: false, error: 'Referral code not found' }
  }

  // Check if referrer has reached max referrals
  if (referrer.referralCount >= MAX_REFERRALS_PER_USER) {
    return { valid: false, error: 'Referral code is no longer active' }
  }

  return {
    valid: true,
    referrerId: referrer.id,
    referrerName: referrer.name
  }
}

/**
 * Creates a pending referral when a new user signs up with a referral code
 */
export async function createPendingReferral(
  referrerId: string,
  refereeId: string,
  referralCode: string,
  source: 'web' | 'mobile'
): Promise<{ id: string } | null> {
  try {
    // Check if referral already exists for this referee
    const existing = await prisma.referral.findUnique({
      where: { refereeId },
      select: { id: true }
    })

    if (existing) {
      console.log(`Referral already exists for referee ${refereeId}`)
      return existing
    }

    // Check if referrer has reached max referrals
    const referrer = await prisma.user.findUnique({
      where: { id: referrerId },
      select: { referralCount: true }
    })

    if (!referrer || referrer.referralCount >= MAX_REFERRALS_PER_USER) {
      console.log(`Referrer ${referrerId} has reached max referrals`)
      return null
    }

    // Create pending referral
    const referral = await prisma.referral.create({
      data: {
        referrerId,
        refereeId,
        referralCode,
        bonusCredits: REFERRAL_BONUS_CREDITS,
        status: 'PENDING',
        source
      }
    })

    // Update referee's referredById
    await prisma.user.update({
      where: { id: refereeId },
      data: { referredById: referrerId }
    })

    console.log(`Created pending referral ${referral.id} for referee ${refereeId}`)
    return { id: referral.id }
  } catch (error) {
    console.error('Error creating pending referral:', error)
    return null
  }
}

/**
 * Completes a referral when the referee verifies their email or completes OAuth
 * Awards bonus credits to BOTH the referrer and the referee
 */
export async function completeReferral(refereeId: string): Promise<boolean> {
  try {
    // Find pending referral for this referee
    const referral = await prisma.referral.findUnique({
      where: { refereeId },
      include: {
        referrer: {
          select: { id: true, referralCount: true, freeBonusCredits: true }
        }
      }
    })

    if (!referral) {
      console.log(`No referral found for referee ${refereeId}`)
      return false
    }

    if (referral.status !== 'PENDING') {
      console.log(`Referral ${referral.id} is not pending (status: ${referral.status})`)
      return false
    }

    // Check if referrer has reached max referrals (double check)
    if (referral.referrer.referralCount >= MAX_REFERRALS_PER_USER) {
      console.log(`Referrer ${referral.referrerId} has reached max referrals`)
      // Mark referral as expired
      await prisma.referral.update({
        where: { id: referral.id },
        data: { status: 'EXPIRED' }
      })
      return false
    }

    // Complete referral and award credits to BOTH parties in a transaction
    await prisma.$transaction([
      // Update referral status
      prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      }),
      // Award credits and increment referral count for referrer
      prisma.user.update({
        where: { id: referral.referrerId },
        data: {
          freeBonusCredits: {
            increment: referral.bonusCredits
          },
          referralCount: {
            increment: 1
          }
        }
      }),
      // Award credits to the referee as well
      prisma.user.update({
        where: { id: refereeId },
        data: {
          freeBonusCredits: {
            increment: referral.bonusCredits
          }
        }
      })
    ])

    console.log(`Completed referral ${referral.id}: awarded ${referral.bonusCredits} credits to referrer ${referral.referrerId} and referee ${refereeId}`)
    return true
  } catch (error) {
    console.error('Error completing referral:', error)
    return false
  }
}

/**
 * Gets referral statistics for a user
 */
export async function getUserReferralStats(userId: string): Promise<ReferralStats> {
  // Ensure user has a referral code
  const referralCode = await ensureUserHasReferralCode(userId)

  // Get user stats
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      referralCount: true,
      freeBonusCredits: true
    }
  })

  // Get referral history
  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    include: {
      referee: {
        select: {
          email: true,
          name: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  const referralCount = user?.referralCount ?? 0
  const totalCreditsEarned = user?.freeBonusCredits ?? 0

  return {
    referralCode,
    referralCount,
    totalCreditsEarned,
    maxReferrals: MAX_REFERRALS_PER_USER,
    remainingReferrals: Math.max(0, MAX_REFERRALS_PER_USER - referralCount),
    referrals: referrals.map(r => ({
      id: r.id,
      refereeEmail: r.referee.email,
      refereeName: r.referee.name,
      status: r.status,
      bonusCredits: r.bonusCredits,
      createdAt: r.createdAt,
      completedAt: r.completedAt
    }))
  }
}
