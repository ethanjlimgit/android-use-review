/**
 * WebSocket Server - Phone-initiated connections for task execution.
 * Ported from Python: api/websocket_server.py (1775 lines)
 *
 * Protocol:
 * 1. Phone connects to ws://backend:port
 * 2. Phone sends JWT auth + task request
 * 3. Server orchestrates LLM agents
 * 4. Server sends device commands ↔ phone executes
 * 5. Server returns task result
 */

import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { InMemoryRunner } from '@google/adk';
import type { Content } from '@google/genai';
import { createChildLogger } from '../logger.js';
import type { AndroidUseConfig } from '../config/schema.js';
import { createLlm, createLlmMap } from '../models/index.js';
import { WebSocketConnectionTool } from '../tools/ws-connection-tool.js';
import { createDeviceTools } from '../tools/device-tools.js';
import { DroidAgent, type DroidAgentConfig } from '../agents/droid-agent.js';
import { createInitialState } from '../agents/state.js';
import { getPluginManager } from '../plugins/manager.js';
import { suggestTasks } from '../agents/suggester.js';
import { verifyMobileToken, extractBearerToken } from '../http/auth.js';
import { prisma } from '../prisma.js';

const log = createChildLogger('ws-server');

interface DeviceConnection {
  ws: WebSocket;
  wsTool: WebSocketConnectionTool;
  userId: string | null;
  deviceId: string | null;
  connectionId: string;
  connectedAt: number;
  currentTaskId: string | null;
}

export class AgentWebSocketServer {
  private wss: WebSocketServer | null = null;
  private connections = new Map<string, DeviceConnection>();
  private config: AndroidUseConfig;

  constructor(config: AndroidUseConfig) {
    this.config = config;
  }

  /**
   * Start the WebSocket server.
   */
  start(host: string, port: number): void {
    this.wss = new WebSocketServer({
      host,
      port,
      maxPayload: this.config.websocketServer.maxMessageSize,
    });

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.wss.on('error', (err) => log.error(`WebSocket server error: ${err.message}`));

    log.info(`WebSocket server started on ws://${host}:${port}`);
    log.info(
      `Auth: ${this.config.websocketServer.authEnabled ? 'enabled' : 'disabled'}`,
    );
  }

  /**
   * Stop the server and close all connections.
   */
  async stop(): Promise<void> {
    // Cleanup all connections
    for (const [id, conn] of this.connections) {
      await conn.wsTool.cleanup();
      conn.ws.close(1000, 'Server shutting down');
      this.connections.delete(id);
    }

    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => {
          log.info('WebSocket server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle new WebSocket connection from phone.
   */
  private async handleConnection(
    ws: WebSocket,
    req: IncomingMessage,
  ): Promise<void> {
    const connectionId = randomUUID();
    const clientIp =
      req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown';
    log.info(`New connection from ${clientIp} (id: ${connectionId.slice(0, 8)})`);

    // Authenticate connection if auth is enabled
    let authenticatedUserId: string | null = null;
    let authenticatedDeviceId: string | null = null;

    if (this.config.websocketServer.authEnabled) {
      const authHeader = req.headers.authorization ?? null;
      const xDeviceId = (req.headers['x-device-id'] as string) ?? null;

      const token = extractBearerToken(authHeader);
      if (!token) {
        log.warn(`Connection ${connectionId.slice(0, 8)}: missing Authorization header, closing`);
        ws.close(1008, 'Missing Authorization header');
        return;
      }

      const user = verifyMobileToken(token);
      if (!user) {
        log.warn(`Connection ${connectionId.slice(0, 8)}: invalid or expired token, closing`);
        ws.close(1008, 'Invalid or expired token');
        return;
      }

      authenticatedUserId = user.id;

      if (!xDeviceId) {
        log.warn(`Connection ${connectionId.slice(0, 8)}: missing X-Device-Id header, closing`);
        ws.close(1008, 'Missing X-Device-Id header');
        return;
      }

      // Look up device — phone sends the DB primary key as X-Device-Id
      const device = await prisma.device.findFirst({
        where: { id: xDeviceId, userId: user.id },
      });

      if (!device) {
        log.warn(`Connection ${connectionId.slice(0, 8)}: device "${xDeviceId}" not found for user ${user.id}, closing`);
        ws.close(1008, 'Device not found');
        return;
      }

      authenticatedDeviceId = device.id;
      log.info(`Connection ${connectionId.slice(0, 8)}: authenticated user=${user.id}, device=${device.id}`);
    }

    // Create WebSocket connection tool
    const wsTool = new WebSocketConnectionTool(ws);

    const conn: DeviceConnection = {
      ws,
      wsTool,
      userId: authenticatedUserId,
      deviceId: authenticatedDeviceId,
      connectionId,
      connectedAt: Date.now(),
      currentTaskId: null,
    };

    this.connections.set(connectionId, conn);

    // Set up message handler - route to tool
    ws.on('message', (data: RawData, isBinary: boolean) => {
      if (isBinary) {
        log.debug(`<< WS binary message: ${(data as Buffer).length} bytes (conn: ${connectionId.slice(0, 8)})`);
        wsTool.handleBinaryResponse(data as Buffer);
      } else {
        const message = data.toString('utf-8');
        log.debug(`<< WS text message: ${message.slice(0, 200)} (conn: ${connectionId.slice(0, 8)})`);
        this.handleMessage(connectionId, message);
      }
    });

    ws.on('close', (code, reason) => {
      log.info(
        `Connection closed: ${connectionId.slice(0, 8)} (code: ${code}, reason: ${reason.toString()})`,
      );
      wsTool.cleanup().catch(() => {});
      this.connections.delete(connectionId);
    });

    ws.on('error', (err) => {
      log.error(
        `Connection error ${connectionId.slice(0, 8)}: ${err.message}`,
      );
    });

    // Set up ping/pong keepalive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, this.config.websocketServer.pingInterval * 1000);

    ws.on('close', () => clearInterval(pingInterval));

    // Wait for initial task request with timeout
    try {
      await this.waitForTaskRequest(connectionId);
    } catch (err) {
      log.error(
        `Failed to receive task request: ${(err as Error).message}`,
      );
      ws.close(1008, 'No task request received');
    }
  }

  /**
   * Handle incoming message from device.
   */
  private handleMessage(connectionId: string, message: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    try {
      const data = JSON.parse(message) as Record<string, unknown>;

      // Handle suggest_tasks request
      if (data.type === 'suggest_tasks') {
        this.handleSuggestTasks(connectionId, data).catch((err) => {
          log.error(
            `Suggest tasks error: ${(err as Error).message}`,
          );
        });
        return;
      }

      // Check if this is a task request (has 'command' or 'task_id')
      if ('command' in data || 'task_id' in data) {
        this.handleTaskRequest(connectionId, data).catch((err) => {
          log.error(
            `Task execution error: ${(err as Error).message}`,
          );
        });
        return;
      }

      // Otherwise, it's a response to a pending request
      conn.wsTool.handleResponse(message);
    } catch {
      // Not JSON or parse error - try as raw response
      conn.wsTool.handleResponse(message);
    }
  }

  /**
   * Wait for the initial task request from the phone.
   */
  private waitForTaskRequest(connectionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for task request'));
      }, this.config.websocketServer.initialRecvTimeout * 1000);

      const conn = this.connections.get(connectionId);
      if (!conn) {
        clearTimeout(timeout);
        reject(new Error('Connection not found'));
        return;
      }

      // Task request will be handled by handleMessage -> handleTaskRequest
      // We just need to wait for it to arrive
      const checkInterval = setInterval(() => {
        if (conn.currentTaskId !== null) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve();
        }
        // Also check if connection closed
        if (conn.ws.readyState !== WebSocket.OPEN) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          reject(new Error('Connection closed before task request'));
        }
      }, 100);
    });
  }

  /**
   * Handle a task request from the phone.
   */
  private async handleTaskRequest(
    connectionId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    const taskId = (data.task_id as string) ?? randomUUID();
    const command = (data.command as string) ?? '';

    // Use authenticated values from connection; fall back to payload only when auth is disabled
    const userId = conn.userId ?? (data.user_id as string) ?? null;
    const deviceId = conn.deviceId ?? (data.device_id as string) ?? null;

    conn.currentTaskId = taskId;

    log.info(`Task request received: taskId=${taskId}, command="${command.slice(0, 100)}"`);

    // Emit TASK_START plugin event (fire-and-forget)
    const pluginManager = getPluginManager();
    pluginManager.emitTaskStart({
      taskId,
      command,
      userId,
      deviceId,
    });

    const taskStartTime = performance.now();

    try {
      // Create LLM instances from top-level profiles + agent sub-config overrides
      log.info(`Task ${taskId}: creating LLM instances...`);
      const llms = createLlmMap(this.config.llmProfiles, this.config.apiKeys);

      // Backfill from agent sub-config LLM fields (agent.codeact.llm, agent.manager.llm, etc.)
      const agentLlmOverrides: Record<string, typeof this.config.agent.codeact.llm> = {
        codeact: this.config.agent.codeact.llm,
        manager: this.config.agent.manager.llm,
        executor: this.config.agent.executor.llm,
      };
      for (const [name, profile] of Object.entries(agentLlmOverrides)) {
        if (profile && !llms[name]) {
          try {
            llms[name] = createLlm(profile, this.config.apiKeys);
            log.info(`LLM created from agent.${name}.llm: ${profile.provider}/${profile.model}`);
          } catch (err) {
            log.warn(`Failed to create LLM from agent.${name}.llm: ${(err as Error).message}`);
          }
        }
      }

      log.info(`Task ${taskId}: created ${Object.keys(llms).length} LLM instances: ${Object.keys(llms).join(', ')}`);

      // Create device tools
      const deviceTools = createDeviceTools(conn.wsTool, {
        disabledTools: this.config.tools.disabledTools,
      });

      // Create DroidAgent
      log.info(`Task ${taskId}: creating DroidAgent (reasoning=${this.config.agent.reasoning})...`);
      const agentConfig: DroidAgentConfig = {
        agentConfig: this.config.agent,
        llms,
        deviceTools,
        wsTool: conn.wsTool,
        promptsDir: resolve(this.config.agent.promptsDir),
      };

      const droidAgent = new DroidAgent(agentConfig);

      // Create ADK runner
      const runner = new InMemoryRunner({
        appName: 'droiduse',
        agent: droidAgent,
      });

      // Create session with initial state (use runner's internal session service)
      const session = await runner.sessionService.createSession({
        appName: 'droiduse',
        userId: userId ?? 'anonymous',
        state: createInitialState({
          instruction: command,
          taskId,
          userId,
          deviceId,
          connectionId,
          taskStartTime: performance.now(),
        }) as unknown as Record<string, unknown>,
      });
      log.info(`Task ${taskId}: session created (id: ${session.id})`);

      // Run the agent
      const userMessage: Content = {
        role: 'user',
        parts: [{ text: command }],
      };

      let finalResponse = '';
      let stepCount = 0;

      log.info(`Task ${taskId}: starting agent execution...`);
      for await (const event of runner.runAsync({
        userId: userId ?? 'anonymous',
        sessionId: session.id,
        newMessage: userMessage,
      })) {
        // Stream events for progress tracking
        const text = event.content?.parts
          ?.map((p: { text?: string }) => p.text)
          .filter(Boolean)
          .join('');

        if (text) {
          finalResponse = text;
        }

        // Emit TASK_STEP plugin event (fire-and-forget)
        stepCount++;
        pluginManager.emitTaskStep({
          taskId,
          stepNumber: stepCount,
          event,
        });
      }

      const elapsed = ((performance.now() - taskStartTime) / 1000).toFixed(2);

      // Send result back to phone
      const result = {
        type: 'task_result',
        task_id: taskId,
        status: conn.wsTool.success ? 'success' : 'failed',
        result: conn.wsTool.reason ?? finalResponse,
      };

      if (conn.ws.readyState === WebSocket.OPEN) {
        log.info(`>> WS send task_result: taskId=${taskId} status=${result.status}`);
        conn.ws.send(JSON.stringify(result));
      }

      // Emit TASK_END plugin event (fire-and-forget)
      pluginManager.emitTaskEnd({
        taskId,
        success: conn.wsTool.success ?? false,
        reason: conn.wsTool.reason ?? '',
        stepCount:
          (
            session.state as unknown as { stepNumber?: number }
          ).stepNumber ?? 0,
      });

      log.info(
        `Task completed: taskId=${taskId}, success=${conn.wsTool.success}, steps=${stepCount}, elapsed=${elapsed}s`,
      );
    } catch (err) {
      const elapsed = ((performance.now() - taskStartTime) / 1000).toFixed(2);
      log.error(`Task execution failed: taskId=${taskId}, elapsed=${elapsed}s, error=${(err as Error).message}`);

      // Send error result
      const errorResult = {
        type: 'task_result',
        task_id: taskId,
        status: 'error',
        error: (err as Error).message,
      };

      if (conn.ws.readyState === WebSocket.OPEN) {
        log.info(`>> WS send task_result (error): taskId=${taskId}`);
        conn.ws.send(JSON.stringify(errorResult));
      }

      pluginManager.emitTaskEnd({
        taskId,
        success: false,
        reason: (err as Error).message,
        stepCount: 0,
      });
    } finally {
      conn.currentTaskId = null;
      await conn.wsTool.cleanup();
      log.info(`Task ${taskId}: cleanup complete`);
    }
  }

  /**
   * Handle a suggest_tasks request from the phone.
   * Matches Python: _handle_suggest_tasks()
   */
  private async handleSuggestTasks(
    connectionId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    const requestId = (data.request_id as string) ?? '';
    log.info(`Received suggest_tasks request (id: ${requestId})`);

    try {
      const stateFull = data.state_full as Record<string, unknown> | undefined;
      const screenshotBase64 = data.screenshot_base64 as string | undefined;
      const maxSuggestions = (data.max_suggestions as number) ?? 5;

      if (!stateFull) {
        const errorResponse = {
          type: 'suggest_tasks_response',
          request_id: requestId,
          success: false,
          error: 'Missing required field: state_full',
          suggestions: [],
        };
        if (conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.send(JSON.stringify(errorResponse));
        }
        return;
      }

      // Pick LLM profile: suggester → manager → first available
      let profileName = 'suggester';
      if (!(profileName in this.config.llmProfiles)) {
        profileName = 'manager';
      }
      if (!(profileName in this.config.llmProfiles)) {
        profileName = Object.keys(this.config.llmProfiles)[0] ?? '';
      }

      if (!profileName) {
        log.warn(`suggest_tasks: no LLM profiles configured`);
        const errorResponse = {
          type: 'suggest_tasks_response',
          request_id: requestId,
          success: false,
          error: 'No LLM profiles configured',
          suggestions: [],
        };
        if (conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.send(JSON.stringify(errorResponse));
        }
        return;
      }

      log.info(`suggest_tasks: using LLM profile "${profileName}" (hasScreenshot: ${!!screenshotBase64}, maxSuggestions: ${maxSuggestions})`);
      const profile = this.config.llmProfiles[profileName]!;
      const llm = createLlm(profile, this.config.apiKeys);

      // Generate suggestions
      const startTime = performance.now();
      const suggestions = await suggestTasks(llm, {
        stateFull,
        screenshotBase64,
        maxSuggestions,
      });
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

      // Send response
      const response = {
        type: 'suggest_tasks_response',
        request_id: requestId,
        success: true,
        context_summary: suggestions.context_summary,
        suggestions: suggestions.suggestions,
      };

      if (conn.ws.readyState === WebSocket.OPEN) {
        log.info(`>> WS send suggest_tasks_response: ${suggestions.suggestions.length} suggestions`);
        conn.ws.send(JSON.stringify(response));
      }

      log.info(
        `suggest_tasks complete: ${suggestions.suggestions.length} suggestions, elapsed=${elapsed}s, context="${suggestions.context_summary.slice(0, 80)}"`,
      );
      for (const s of suggestions.suggestions) {
        log.info(`  suggestion: "${s.title}" -> "${s.command.slice(0, 100)}"`);
      }
    } catch (err) {
      log.error(`Failed to generate task suggestions: ${(err as Error).message}`);
      const errorResponse = {
        type: 'suggest_tasks_response',
        request_id: requestId,
        success: false,
        error: (err as Error).message,
        suggestions: [],
      };
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify(errorResponse));
      }
    }
  }

  // ── Status & Monitoring ──

  getConnectionCount(): number {
    return this.connections.size;
  }

  getActiveTaskCount(): number {
    let count = 0;
    for (const conn of this.connections.values()) {
      if (conn.currentTaskId) count++;
    }
    return count;
  }

  getStatus(): Record<string, unknown> {
    return {
      connections: this.connections.size,
      activeTasks: this.getActiveTaskCount(),
      uptime: process.uptime(),
    };
  }
}
