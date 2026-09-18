/**
 * Health check and status routes.
 */

import type { FastifyInstance } from 'fastify';

export async function healthRoutes(
  app: FastifyInstance,
  opts: { getStatus: () => Record<string, unknown> },
): Promise<void> {
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  app.get('/status', async () => {
    return opts.getStatus();
  });
}
