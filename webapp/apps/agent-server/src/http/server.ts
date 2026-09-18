/**
 * HTTP API Server - Fastify-based REST API running alongside the WebSocket server.
 * Equivalent to Python backend's app_card_server.py.
 *
 * Endpoints:
 *   GET  /health         - Health check
 *   GET  /status         - Server status (connections, active tasks)
 *   POST /app-knowledge  - App-specific knowledge for agents
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { createChildLogger } from '../logger.js';
import { healthRoutes } from './routes/health.js';
import { skillRoutes } from './routes/skills.js';

const log = createChildLogger('http-server');

export class HttpApiServer {
  private app: FastifyInstance;
  private getWsStatus: () => Record<string, unknown>;

  constructor(getWsStatus: () => Record<string, unknown>) {
    this.getWsStatus = getWsStatus;

    this.app = Fastify({
      logger: false, // We use our own pino logger
    });

    // Global error handler
    this.app.setErrorHandler(
      (error: Error & { statusCode?: number; code?: string }, request, reply) => {
        if (error.name === 'ZodError') {
          return reply.code(400).send({
            error: 'Validation error',
            details: JSON.parse(error.message),
          });
        }

        log.error(
          `Error on ${request.method} ${request.url}: ${error.message}`,
        );
        return reply.code(error.statusCode ?? 500).send({
          error: error.message || 'Internal server error',
        });
      },
    );
  }

  /**
   * Register all routes and start listening.
   */
  async start(host: string, port: number): Promise<void> {
    await this.app.register(async (instance) =>
      healthRoutes(instance, { getStatus: this.getWsStatus }),
    );
    await this.app.register(skillRoutes);

    await this.app.listen({ host, port });
    log.info(`HTTP API server started on http://${host}:${port}`);
  }

  async stop(): Promise<void> {
    await this.app.close();
    log.info('HTTP API server stopped');
  }
}
