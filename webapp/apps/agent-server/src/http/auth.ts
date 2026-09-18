/**
 * JWT authentication for HTTP and WebSocket routes.
 * Uses jsonwebtoken (same library as shared-lib's verifyMobileToken).
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('http-auth');

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

/**
 * Extract Bearer token from Authorization header.
 */
export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1] ?? null;
}

/**
 * Verify a mobile JWT token and return the user data.
 * Aligned with shared-lib's verifyMobileToken implementation.
 */
export function verifyMobileToken(token: string): AuthUser | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    log.error('AUTH_SECRET is not configured');
    return null;
  }

  try {
    const decoded = jwt.verify(token, secret) as {
      userId?: string;
      email?: string;
      name?: string;
      role?: string;
      type?: string;
    };

    if (!decoded.userId || !decoded.email) {
      log.error('Invalid token payload: missing userId or email');
      return null;
    }

    // Reject refresh tokens
    if (decoded.type === 'refresh') {
      log.error('Refresh token used as access token');
      return null;
    }

    return {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.name ?? null,
      role: decoded.role ?? 'user',
    };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      log.warn('Token expired');
    } else if (err instanceof jwt.JsonWebTokenError) {
      log.warn(`Invalid token: ${err.message}`);
    } else {
      log.warn(`Token verification failed: ${(err as Error).message}`);
    }
    return null;
  }
}

/**
 * Fastify preHandler hook that requires authentication.
 * Attaches `request.user` on success, sends 401 on failure.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = extractBearerToken(request.headers.authorization);

  if (!token) {
    reply.code(401).send({ error: 'Missing Authorization header' });
    return;
  }

  const user = verifyMobileToken(token);
  if (!user) {
    reply.code(401).send({ error: 'Invalid or expired token' });
    return;
  }

  // Attach user to request
  (request as FastifyRequest & { user: AuthUser }).user = user;
}

/**
 * Optional auth - attaches user if token present, but doesn't fail.
 */
export async function optionalAuth(
  request: FastifyRequest,
): Promise<void> {
  const token = extractBearerToken(request.headers.authorization);
  if (!token) return;

  const user = verifyMobileToken(token);
  if (user) {
    (request as FastifyRequest & { user: AuthUser }).user = user;
  }
}

/**
 * Helper to get the authenticated user from a request.
 */
export function getUser(request: FastifyRequest): AuthUser {
  return (request as FastifyRequest & { user: AuthUser }).user;
}

/**
 * Helper to get the optional authenticated user from a request.
 */
export function getUserOptional(request: FastifyRequest): AuthUser | undefined {
  return (request as FastifyRequest & { user?: AuthUser }).user;
}

/**
 * Get device ID from X-Device-Id header.
 */
export function getDeviceIdHeader(request: FastifyRequest): string | null {
  return (request.headers['x-device-id'] as string) ?? null;
}
