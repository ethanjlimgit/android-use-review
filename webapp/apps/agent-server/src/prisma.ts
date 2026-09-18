/**
 * Re-export the Prisma client singleton from shared-lib.
 * Uses the same PrismaClient + PrismaPg adapter setup as the frontend.
 */

export { prisma } from '@droiduse/shared-lib/prisma';
