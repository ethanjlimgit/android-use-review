/**
 * Agent Server - Main entry point for WebSocket + HTTP servers.
 * Orchestrates startup: config loading, plugin registration, server start.
 */

import { createChildLogger } from './logger.js';
import { loadConfig, loadDefaultConfig } from './config/index.js';
import type { AndroidUseConfig } from './config/index.js';
import { AgentWebSocketServer } from './websocket/server.js';
import { HttpApiServer } from './http/server.js';
import { getPluginManager } from './plugins/manager.js';
import { LocalLoggingPlugin } from './plugins/local-logging.js';

const log = createChildLogger('server');

export interface ServerOptions {
  host: string;
  port: number;
  configPath?: string;
  debug?: boolean;
}

export async function startServer(options: ServerOptions): Promise<void> {
  const { host, port, configPath, debug } = options;

  // Set log level
  if (debug) {
    process.env.LOG_LEVEL = 'debug';
  }

  log.info('Starting Agent Server...');

  // Load configuration
  let config: AndroidUseConfig;
  if (configPath) {
    log.info(`Loading config from ${configPath}`);
    config = loadConfig(configPath);
  } else {
    config = loadDefaultConfig();
  }

  // Initialize plugin system
  const pluginManager = getPluginManager();

  if (config.plugins.localLogging.enabled) {
    await pluginManager.register(new LocalLoggingPlugin());
  }

  // TODO: Register additional plugins based on config
  // if (config.plugins.posthogTelemetry.enabled) { ... }
  // if (config.plugins.tracing.enabled) { ... }
  // if (config.plugins.trajectory.enabled) { ... }

  // Start WebSocket server
  const wsServer = new AgentWebSocketServer(config);
  wsServer.start(host, port);

  // Start HTTP API server alongside WebSocket
  let httpServer: HttpApiServer | undefined;
  if (config.httpServer.enabled) {
    const httpPort = config.httpServer.port;
    httpServer = new HttpApiServer(() => wsServer.getStatus());
    await httpServer.start(host, httpPort);
  }

  // Handle graceful shutdown with force-exit timeout for dev restarts
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    log.info(`Received ${signal}, shutting down...`);

    // Force exit after 3s if graceful shutdown hangs (e.g., during dev reload)
    const forceTimer = setTimeout(() => {
      log.warn('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 3000);
    forceTimer.unref();

    try {
      await wsServer.stop();
      if (httpServer) await httpServer.stop();
      await pluginManager.shutdown();
    } catch (err) {
      log.error(`Shutdown error: ${(err as Error).message}`);
    }
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  log.info(`Agent Server ready on ws://${host}:${port}`);
  if (httpServer) {
    log.info(`HTTP API ready on http://${host}:${config.httpServer.port}`);
  }
}
